import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ALIVE_EXPIRE_AFTER, expireSlots, mergeObservations, parseObservation, timerStatus, type Observation } from "../src/domain/timers";
import { defaultSelection } from "../src/domain/catalog";
import { exportTimers, decodeImport } from "../src/backend/exchange";
import { TimerStore } from "../src/backend/timer-store";
import { coordinateLabel } from "../src/ui/timer-presentation";
import { applySync, pendingUploads } from "../src/domain/sync";
const now = 1_789_000_000_000;
const slot = { mobId: "NightmarePaladinBoss", region: "sa", channel: 1 } as const;
const live: Observation = { ...slot, observationId: "living", source: "alive", timePrecision: "millisecond", gatheredAt: now, position: { x: 12, y: 3, z: -21 } };
const kill: Observation = { ...slot, observationId: "grave", source: "gravestone", timePrecision: "millisecond", gatheredAt: now - 1, diedAt: now - 600000 };

test("sighting sync acknowledgements stop repeats and reset cutoffs use observation time", () => {
  const selection = defaultSelection(), slots = mergeObservations([], [live], now);
  expect(pendingUploads(slots, undefined, selection, now)).toEqual([live]);
  const result = { dataset: { datasetId: "group", generation: 1, revision: 1, resetAt: now - 1 }, serverTime: now, full: true,
    acknowledged: [live.observationId], slots: [{ ...slots[0]!, revision: 1 }] };
  const synced = applySync(slots, undefined, result, [live], "connection", "selection", selection, now);
  expect(synced.slots[0]?.observation).toEqual(live);
  expect(pendingUploads(synced.slots, synced.cache, selection, now)).toEqual([]);
  const reset = { ...result, dataset: { ...result.dataset, generation: 2, revision: 2, resetAt: now }, slots: [], acknowledged: [] };
  expect(applySync(slots, synced.cache, reset, [], "connection", "selection", selection, now).slots[0]?.observation).toBeUndefined();
  expect(pendingUploads(slots, undefined, selection, now + ALIVE_EXPIRE_AFTER)).toEqual([]);
});

test("sightings replace older kills, age without inventing respawns, and expire without replay revival", () => {
  const slots = mergeObservations([], [kill, live], now);
  expect(slots[0]?.observation?.source).toBe("alive");
  expect(timerStatus(slots[0]!, now + 59999)).toBe("alive");
  expect(timerStatus(slots[0]!, now + 60000)).toBe("seenAlive");
  expect(expireSlots(slots, now + ALIVE_EXPIRE_AFTER)[0]?.observation).toBeUndefined();
  expect(mergeObservations([], [live], now + ALIVE_EXPIRE_AFTER)[0]?.outdated).toBe(true);
  const killed = mergeObservations(slots, [{ ...kill, observationId: "new-kill", diedAt: now + 1000, gatheredAt: now + 1000 }], now + 1000);
  expect(killed[0]?.observation?.source).toBe("gravestone");
  expect(mergeObservations(killed, [live], now + 1000)).toEqual(killed);
  for (const patch of [{ diedAt: now }, { killedBy: "invented" }, { position: { x: Infinity, y: 0, z: 0 } }, { timePrecision: "minute" }]) expect(() => parseObservation({ ...live, ...patch }, now)).toThrow();
});

test("full exports preserve sighting/position/attribution; text excludes sightings and legacy JSON still imports", () => {
  const row = { ...slot, outdated: false, observation: { ...live, submission: { submittedByCharacter: null, serverAcceptedAt: now } } };
  for (const format of ["json", "compressed"] as const) expect(decodeImport(exportTimers([row], defaultSelection(), now, format).text, now)).toEqual([row.observation]);
  expect(exportTimers([row], defaultSelection(), now, "text")).toEqual({ text: "", count: 0 });
  const legacy = JSON.parse(exportTimers([{ ...slot, outdated: false, observation: kill }], defaultSelection(), now, "json").text); legacy.schemaVersion = 1;
  expect(decodeImport(JSON.stringify(legacy), now)).toEqual([kill]);
  expect(coordinateLabel()).toBe("Not located"); expect(coordinateLabel(live.position)).toBe("12.0, -21.0");
});

test("legacy timer data migrates, and current sightings survive restart then discard their position at expiry", () => {
  const root = mkdtempSync(join(tmpdir(), "mvp-sighting-test-"));
  try {
    mkdirSync(join(root, "data")); const file = join(root, "data/timers.json");
    writeFileSync(file, JSON.stringify({ schemaVersion: 1, slots: [{ ...slot, outdated: false, observation: kill }] }));
    const store = new TimerStore(root, defaultSelection(), () => now);
    expect(store.snapshot()[0]?.observation).toEqual(kill); expect(JSON.parse(readFileSync(file, "utf8")).schemaVersion).toBe(2);
    store.ingest([live]); expect(new TimerStore(root, defaultSelection(), () => now).snapshot()[0]?.observation).toEqual(live);
    expect(new TimerStore(root, defaultSelection(), () => now + ALIVE_EXPIRE_AFTER).snapshot()[0]).toEqual({ ...slot, outdated: true });
  } finally { if (!root.startsWith(join(tmpdir(), "mvp-sighting-test-"))) throw new Error("Unsafe cleanup."); rmSync(root, { recursive: true, force: true }); }
});
