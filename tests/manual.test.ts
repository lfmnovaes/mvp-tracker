import { expect, test } from "bun:test";
import { manualBosses, manualDraft } from "../src/domain/manual";
import { defaultSelection, bossPreset } from "../src/domain/catalog";
import { applyManual, type TimerSlot } from "../src/domain/timers";
import { parseManualTime, EXPIRE_AFTER } from "../src/domain/time";
import { defaults, parseRequest, parseSettings } from "../src/shared/protocol";

const now = Date.UTC(2026, 8, 10, 18, 20, 30);
const slot = { mobId: "NightmarePaladinBoss", region: "sa", channel: 2 } as const;
const entry = { ...slot, date: "2026-09-10", time: "02:00", clock24: false, meridiem: "PM" as const, killedBy: "" };
function request(input: unknown) { return parseRequest({ id: "manual-save", method: "saveManual", input }); }

test("manual Save strips caller evidence and uses confirmation time; edit keeps its slot fixed", () => {
  const parsed = request({ mode: "edit", originalSlot: slot, entry: { ...entry, gatheredAt: 1, observationId: "forged", source: "gravestone", observedByCharacter: "forged" } });
  if (parsed.method !== "saveManual") throw new Error("Unexpected method");
  expect(parsed.input.entry).not.toHaveProperty("gatheredAt");
  expect(parsed.input.entry).not.toHaveProperty("observedByCharacter");
  const result = applyManual([], parsed.input.entry, now, defaultSelection());
  expect(result[0]!.observation).toMatchObject({ source: "manual", gatheredAt: now, diedAt: Date.UTC(2026, 8, 10, 17) });
  expect(result[0]!.observation?.killedBy).toBeUndefined();
  expect(() => request({ mode: "edit", originalSlot: { ...slot, channel: 1 }, entry })).toThrow("fixed");
  expect(() => request({ mode: "edit", entry })).toThrow();
  expect(() => request({ mode: "add", entry: { ...entry, killedBy: "bad\nname" } })).toThrow();
  expect(() => request({ mode: "add", entry: { ...entry, channel: 4 } })).toThrow();
});

test("manual draft lists selected bosses in level/name order and round-trips explicit clock formats", () => {
  const selection = { ...defaultSelection(), bossIds: bossPreset("all") };
  const bosses = manualBosses(selection);
  for (let i = 1; i < bosses.length; i++) expect(bosses[i - 1]!.level > bosses[i]!.level || bosses[i - 1]!.level === bosses[i]!.level && bosses[i - 1]!.name.localeCompare(bosses[i]!.name, "en") <= 0).toBe(true);
  expect(manualBosses(defaultSelection())).toHaveLength(7);
  expect(manualDraft({ bossIds: [], regions: [] }, false, now)).toBeUndefined();
  for (const clock24 of [true, false]) for (const hour of [0, 12, 23]) {
    const at = Date.UTC(2026, 8, 10, hour + 3, 14, 32);
    const edit: TimerSlot = { ...slot, outdated: false, observation: { ...slot, observationId: "example", diedAt: at, gatheredAt: at, source: "manual", timePrecision: "second", killedBy: "Name" } };
    const draft = manualDraft(selection, clock24, at + 1000, edit)!;
    expect(parseManualTime(draft, at + 1000).diedAt).toBe(at); expect(draft.killedBy).toBe("Name");
  }
});

test("expired manual save clears values, future/invalid dates reject and deselection blocks Save", () => {
  const expired = { ...entry, time: "12:00", meridiem: "AM" as const };
  const result = applyManual([], expired, now, defaultSelection());
  expect(result).toEqual([{ ...slot, outdated: true }]);
  expect(now - parseManualTime(expired, now).diedAt).toBeGreaterThan(EXPIRE_AFTER);
  expect(() => applyManual([], { ...entry, time: "11:59" }, now, defaultSelection())).toThrow("future");
  expect(() => applyManual([], { ...entry, date: "2026-02-30" }, now, defaultSelection())).toThrow("calendar");
  expect(() => applyManual([], entry, now, { bossIds: [], regions: [] })).toThrow("not selected");
});

test("UI scale migrates every previous schema and rejects unsupported values", () => {
  for (const schemaVersion of [1, 2, 3]) expect(parseSettings({ ...defaults(), schemaVersion, uiScale: undefined }).uiScale).toBe(100);
  expect(parseSettings({ ...defaults(), uiScale: 125 }).uiScale).toBe(125);
  for (const uiScale of [0, 500, 99, "100", null]) expect(() => parseSettings({ ...defaults(), uiScale })).toThrow();
});
