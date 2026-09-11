import { test, expect, afterEach } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BOSSES, bossById, bossPreset, defaultSelection, parseSelection, normalizeRegion, regionFromInstance } from "../src/domain/catalog";
import { CLOCK_SKEW, MINUTE, EXPIRE_AFTER, parseManualTime, formatClock, formatTimestamp, dateInZone } from "../src/domain/time";
import { applyManual, emptySlot, expireSlots, mergeObservations, parseObservation, parseTimerState, timerStatus, type Observation, type ManualEntry } from "../src/domain/timers";
import { queryTimers } from "../src/domain/query";
import { TimerStore } from "../src/backend/timer-store";
import { defaults, parseSettings } from "../src/shared/protocol";

const now = Date.UTC(2026, 8, 10, 15);
const slot = { mobId: "NightmarePaladinBoss", region: "sa", channel: 2 } as const;
function observation(id: string, patch: Partial<Observation> = {}): Observation {
  return parseObservation({ ...slot, observationId: id, diedAt: now - 70 * MINUTE, gatheredAt: now - MINUTE,
    source: "manual", timePrecision: "second", killedBy: "Killer", ...patch }, now);
}
function manual(diedAt: number): ManualEntry { return { ...slot, date: dateInZone(diedAt), time: formatClock(diedAt, true, true), clock24: true }; }
const roots: string[] = [];
function temporary(): string { const root = mkdtempSync(join(tmpdir(), "mvp-core-test-")); roots.push(root); return root; }
afterEach(() => { for (const root of roots.splice(0)) {
  if (!root.startsWith(join(tmpdir(), "mvp-core-test-"))) throw new Error("Unsafe test cleanup."); rmSync(root, { recursive: true, force: true });
} });

test("catalog presets protect the exact Endgame group without selecting Weaver or Robot Dragon", () => {
  expect(BOSSES.length).toBe(33);
  expect(new Set(BOSSES.map(b => b.id)).size).toBe(33);
  expect(bossPreset("endgame")).toEqual(["NightmareBerserkerBoss", "NightmareGunslingerBoss", "NightmareNecromancerBoss", "NightmarePaladinBoss", "NightmarePriestBoss", "NightmareShinobiBoss", "NightmareWizardBoss"]);
  expect(bossPreset("all")).toContain("NightmareWeaverBoss");
  expect(bossPreset("all")).toContain("Sting");
  expect(bossById("Dragon Predator Robot")).toBeUndefined();
  expect(bossById("Spider Queen Robot")?.name).toBe("Suphara");
  expect(bossPreset("none")).toEqual([]);
  expect(defaultSelection().regions).toEqual(["sa", "na"]);
  expect(BOSSES.filter(b => b.map !== "").every(b => b.endgame && b.map === "Dark Fortress")).toBe(true);
  expect(normalizeRegion(" SUN ")).toBe("na");
  expect(regionFromInstance("nova123-instance")).toBe("sa");
  expect(regionFromInstance("unknown123")).toBeUndefined();
});

test("Step 1 preferences migrate without losing hotkeys or startup choice", () => {
  const migrated = parseSettings({ schemaVersion: 1, startMinimized: true, clock24: true, hotkeys: { toggle: "Ctrl+F7", add: "", sync: "F9" } });
  expect(migrated.schemaVersion).toBe(6); expect(migrated.startMinimized).toBe(true);
  expect(migrated.hotkeys.add).toBe(""); expect(migrated.tracking).toEqual(defaultSelection());
  expect(parseSettings({ ...defaults(), tracking: { bossIds: [], regions: [] } }).tracking).toEqual({ bossIds: [], regions: [] });
  expect(() => parseSelection({ bossIds: ["Dragon Predator Robot"], regions: ["sa"] })).toThrow();
});

test("São Paulo input handles noon, midnight, seconds and calendar rollover independently of machine timezone", () => {
  const end = Date.UTC(2026, 8, 12);
  expect(parseManualTime({ date: "2026-09-10", time: "12:00", clock24: false, meridiem: "AM" }, end).diedAt).toBe(Date.UTC(2026, 8, 10, 3));
  expect(parseManualTime({ date: "2026-09-10", time: "12:00", clock24: false, meridiem: "PM" }, end).diedAt).toBe(Date.UTC(2026, 8, 10, 15));
  const parsed = parseManualTime({ date: "2026-09-10", time: "9:35:22", clock24: false, meridiem: "PM" }, end);
  expect(parsed.timePrecision).toBe("second"); expect(parsed.diedAt).toBe(Date.UTC(2026, 8, 11, 0, 35, 22));
  expect(formatTimestamp(parsed.diedAt + EXPIRE_AFTER, true)).toBe("2026-09-11 00:05:22");
  expect(() => parseManualTime({ date: "2026-02-30", time: "10:00", clock24: true }, end)).toThrow("calendar");
  expect(() => parseManualTime({ date: "2026-09-10", time: "24:00", clock24: true }, end)).toThrow();
  expect(() => parseManualTime({ date: "2026-09-10", time: "00:00", clock24: false, meridiem: "AM" }, end)).toThrow();
  expect(() => parseManualTime({ date: "2026-09-11", time: "12:00", clock24: true }, now)).toThrow("future");
});

test("+60/+90/+150 boundaries are absolute and expiry discards all observation data", () => {
  const o = observation("boundary"); const tracked = { ...emptySlot(o), observation: o };
  for (const [age, status] of [[60 * MINUTE - 1, "waiting"], [60 * MINUTE, "window"], [90 * MINUTE - 1, "window"], [90 * MINUTE, "spawned"], [150 * MINUTE - 1, "spawned"], [150 * MINUTE, "outdated"]] as const) expect(timerStatus(tracked, o.diedAt + age)).toBe(status);
  expect(expireSlots([tracked], o.diedAt + EXPIRE_AFTER)).toEqual([{ ...slot, outdated: true }]);
  const laterCheck = observation("checked-again", { gatheredAt: now, source: "gravestone" });
  const merged = mergeObservations([tracked], [laterCheck], now);
  expect(merged[0].observation?.diedAt).toBe(o.diedAt);
  expect(expireSlots(merged, o.diedAt + EXPIRE_AFTER)[0].observation).toBeUndefined();
});

test("ordinary merges converge, use gathered time, keep coherent killers and ignore duplicate delivery", () => {
  const old = observation("a", { diedAt: now - 20 * MINUTE, killedBy: "Previous killer" });
  const fresh = observation("b", { gatheredAt: now, diedAt: now - 80 * MINUTE, killedBy: undefined });
  const tied = observation("z", { gatheredAt: now, diedAt: now - 30 * MINUTE, killedBy: "Winner" });
  const permutations = [[old, fresh, tied], [tied, fresh, old], [fresh, old, tied], [old, tied, fresh]];
  const expected = mergeObservations([], permutations[0], now);
  for (const records of permutations) {
    expect(mergeObservations([], records, now)).toEqual(expected);
    expect(records.reduce((state, o) => mergeObservations(state, [o], now), mergeObservations([], [], now))).toEqual(expected);
  }
  const corrected = mergeObservations(mergeObservations([], [old], now), [fresh], now);
  expect(corrected[0].observation?.diedAt).toBe(fresh.diedAt);
  expect(corrected[0].observation?.killedBy).toBeUndefined();
  expect(mergeObservations(expected, [tied, old], now)).toEqual(expected);
  expect(() => mergeObservations(expected, [{ ...tied, killedBy: "Tampered" }], now)).toThrow("reused");
});

test("manual edits can correct kills in both directions and fresh capture can replace manual evidence", () => {
  const initial = mergeObservations([], [observation("captured", { source: "gravestone" })], now);
  const earlier = applyManual(initial, manual(now - 80 * MINUTE), now, defaultSelection());
  expect(earlier[0].observation?.source).toBe("manual");
  expect(earlier[0].observation?.diedAt).toBe(now - 80 * MINUTE);
  expect(earlier[0].observation?.gatheredAt).toBe(now);
  expect(earlier[0].observation?.replacesObservationId).toBe("captured");
  const later = applyManual(earlier, manual(now - 20 * MINUTE), now + 1, defaultSelection());
  expect(later[0].observation?.diedAt).toBe(now - 20 * MINUTE);
  const automatic = observation("new-capture", { source: "gravestone", gatheredAt: now + 2, diedAt: now - 10 * MINUTE });
  expect(mergeObservations(later, [automatic], now + 2)[0].observation?.source).toBe("gravestone");
});

test("stale imported evidence cannot clear an active timer; explicit expired manual edit can", () => {
  const active = mergeObservations([], [observation("active")], now);
  const expired = observation("stale", { diedAt: now - EXPIRE_AFTER, gatheredAt: now });
  expect(mergeObservations(active, [expired], now)).toEqual(active);
  expect(mergeObservations([], [expired], now)).toEqual([{ ...slot, outdated: true }]);
  expect(applyManual(active, manual(now - EXPIRE_AFTER), now, defaultSelection())).toEqual([{ ...slot, outdated: true }]);
});

test("invalid batches fail atomically, unknown slots stay unresolved and future skew is bounded", () => {
  const valid = observation("valid");
  for (const patch of [{ mobId: "Dragon Predator Robot" }, { region: "?" }, { channel: 4 }, { diedAt: NaN }, { gatheredAt: now + CLOCK_SKEW + 1 }, { killedBy: "x".repeat(81) }, { source: "import" }]) expect(() => mergeObservations([], [valid, { ...valid, observationId: "bad", ...patch }], now)).toThrow();
  expect(parseObservation({ ...valid, gatheredAt: now + CLOCK_SKEW }, now).gatheredAt).toBe(now + CLOCK_SKEW);
  expect(() => parseObservation({ ...valid, source: "gravestone", diedAt: now - 91 * MINUTE, gatheredAt: now }, now)).toThrow("contradicts");
  expect(() => parseTimerState({ schemaVersion: 1, slots: [{ ...slot, outdated: false, observation: { ...valid, channel: 1 } }] }, now)).toThrow("mismatch");
});

test("deselection hides and stops ingestion without deleting retained observations", () => {
  const root = temporary(); let clock = now;
  const store = new TimerStore(root, defaultSelection(), () => clock);
  store.ingest([observation("selected")]);
  store.setSelection({ bossIds: [], regions: [] });
  expect(store.selectedSnapshot()).toEqual([]); expect(store.snapshot().length).toBe(1);
  expect(store.ingest([observation("not-accepted", { gatheredAt: now })])).toBe(false);
  expect(() => store.saveManual(manual(now - MINUTE))).toThrow("not selected");
  store.setSelection(defaultSelection()); expect(store.selectedSnapshot()[0].observation?.observationId).toBe("selected");
  clock += EXPIRE_AFTER; store.expire(); expect(store.snapshot()[0]).toEqual({ ...slot, outdated: true });
  expect(readFileSync(store.file, "utf8")).not.toContain("selected");
});

test("restart removes expired values and committed data wins over interrupted-save leftovers", () => {
  const root = temporary(); const store = new TimerStore(root, defaultSelection(), () => now);
  store.ingest([observation("persisted")]);
  writeFileSync(`${store.file}.tmp`, '{"interrupted":true}');
  const restarted = new TimerStore(root, defaultSelection(), () => now + EXPIRE_AFTER);
  expect(restarted.snapshot()).toEqual([{ ...slot, outdated: true }]);
  expect(readFileSync(store.file, "utf8")).not.toContain("Killer");
  expect(readFileSync(store.file, "utf8")).not.toContain("gatheredAt");
  expect(existsSync(`${store.file}.tmp`)).toBe(false);
});

test("removing one local slot persists, preserves other slots and allows a later observation", () => {
  const root = temporary(); const store = new TimerStore(root, defaultSelection(), () => now);
  store.ingest([observation("removed"), observation("kept", { channel: 1 })]);
  expect(store.remove(slot)).toBe(true);
  expect(store.remove(slot)).toBe(false);
  const restarted = new TimerStore(root, defaultSelection(), () => now);
  expect(restarted.snapshot().map(s => s.observation?.observationId)).toEqual(["kept"]);
  expect(readFileSync(store.file, "utf8")).not.toContain("removed");
  restarted.ingest([observation("new-check", { gatheredAt: now })]);
  expect(restarted.snapshot()).toHaveLength(2);
  expect(() => restarted.remove({ ...slot, channel: 4 } as never)).toThrow();
  expect(restarted.snapshot()).toHaveLength(2);
});

test("24-hour defaults migrate once and an explicit AM/PM choice remains available", () => {
  expect(defaults().clock24).toBe(true);
  for (const schemaVersion of [1, 2, 3, 4]) {
    expect(parseSettings({ ...defaults(), schemaVersion, clock24: false }).clock24).toBe(true);
  }
  expect(parseSettings({ ...defaults(), clock24: false }).clock24).toBe(false);
  const at = Date.UTC(2026, 8, 10, 23, 35, 22);
  expect(formatClock(at)).toBe("20:35");
  expect(formatTimestamp(at)).toBe("2026-09-10 20:35:22");
  expect(formatClock(at, false)).toBe("8:35 PM");
});

test("orphaned temporary data recovers; corrupt originals remain preserved", () => {
  const root = temporary(); mkdirSync(join(root, "data"));
  const file = join(root, "data", "timers.json");
  writeFileSync(`${file}.tmp`, JSON.stringify({ schemaVersion: 1, slots: mergeObservations([], [observation("recovered")], now) }));
  expect(new TimerStore(root, defaultSelection(), () => now).snapshot()[0].observation?.observationId).toBe("recovered");
  expect(existsSync(file)).toBe(true);
  writeFileSync(file, '{"schemaVersion":99}');
  const corrupt = new TimerStore(root, defaultSelection(), () => now); corrupt.ingest([observation("memory-only")]); corrupt.close();
  expect(corrupt.warning).toContain("preserved"); expect(readFileSync(file, "utf8")).toBe('{"schemaVersion":99}');
});

test("a failed disk save retains in-memory observations and retries without data loss", () => {
  const root = temporary(); writeFileSync(join(root, "data"), "blocked directory");
  const store = new TimerStore(root, defaultSelection(), () => now);
  store.ingest([observation("unsaved")]);
  expect(store.warning).toContain("held in memory");
  expect(store.snapshot()[0].observation?.observationId).toBe("unsaved");
  unlinkSync(join(root, "data")); store.flush();
  expect(store.warning).toBeNull();
  expect(new TimerStore(root, defaultSelection(), () => now).snapshot()[0].observation?.observationId).toBe("unsaved");
});

test("search isolates region/channel tokens and sorting uses numeric/time fields", () => {
  const records = [observation("waiting", { channel: 1, diedAt: now - 20 * MINUTE, killedBy: "Luís" }), observation("window", { channel: 2 }), observation("spawned", { channel: 3, diedAt: now - 100 * MINUTE })];
  const slots = mergeObservations([], records, now);
  expect(queryTimers(slots, defaultSelection(), now).map(r => r.slot.channel)).toEqual([2, 1, 3]);
  expect(queryTimers(slots, defaultSelection(), now, { search: "paladin sa ch2 dark fortress" }).map(r => r.slot.channel)).toEqual([2]);
  expect(queryTimers(slots, defaultSelection(), now, { search: "region:nova killer:luis" }).map(r => r.slot.channel)).toEqual([1]);
  expect(queryTimers(slots, defaultSelection(), now, { search: "ch:155" })).toEqual([]);
  expect(queryTimers(slots, defaultSelection(), now, { search: "region:na" })).toEqual([]);
  expect(queryTimers(slots, defaultSelection(), now, { sort: { field: "channel", direction: "desc" } }).map(r => r.slot.channel)).toEqual([3, 2, 1]);
});
