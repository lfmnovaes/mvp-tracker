import { expect, test } from "bun:test";
import { availableChannels } from "../src/domain/channels";
import { defaultSelection, MAX_CHANNEL } from "../src/domain/catalog";
import { manualDraft } from "../src/domain/manual";
import { expireSlots, mergeObservations, parseObservation, parseSlot, parseTimerState, TIMER_SCHEMA, type Observation } from "../src/domain/timers";
import { EXPIRE_AFTER } from "../src/domain/time";
import { decodeImport, exportTimers } from "../src/backend/exchange";
import { applySync, validateSyncResult } from "../src/domain/sync";
const now = Date.UTC(2026, 9, 10, 18), selection = defaultSelection();
function observation(channel: number, region: "sa" | "na" | "eu" = "sa", mobId = "NightmarePaladinBoss"): Observation {
  return parseObservation({ mobId, region, channel, ...(channel > 3 ? { pvp: true } : {}), observationId: `pvp-${channel}-${region}`, diedAt: now - 60000, gatheredAt: now, source: "gravestone", timePrecision: "second", killedBy: "Party Killer" }, now);
}
test("PvP channels persist, merge and export in all formats without becoming outdated on sync", () => {
  const slots = mergeObservations([], [observation(1), observation(5), observation(10, "na")], now);
  expect(parseTimerState(JSON.parse(JSON.stringify({ schemaVersion: TIMER_SCHEMA, slots })), now)).toEqual(slots);
  for (const format of ["json", "compressed"] as const) expect(decodeImport(exportTimers(slots, selection, now, format).text, now)).toEqual(slots.map(s => s.observation!));
  const text = exportTimers(slots, selection, now, "text"); expect(text.count).toBe(3); expect(text.text).toContain("Ch5:"); expect(text.text).toContain("Ch10:"); expect(text.text).not.toContain("Ch4:");
  const dataset = { datasetId: "test", generation: 1, revision: 1, resetAt: 0 };
  const response = validateSyncResult({ dataset, serverTime: now, full: true, slots: slots.map(s => ({ ...s, revision: 1 })), acknowledged: [] }, now);
  expect(applySync(slots, undefined, response, [], "a".repeat(64), "all", now).slots).toEqual(slots);
  const expired = expireSlots(slots, now + EXPIRE_AFTER); expect(expired.find(s => s.channel === 5)).toMatchObject({ pvp: true, outdated: true });
  expect(manualDraft(selection, true, now, slots.find(s => s.channel === 5))).toMatchObject({ channel: 5, pvp: true });
});
test("channel options honor visible boss, region and location scopes without inventing gaps", () => {
  const slots = mergeObservations([], [observation(5), observation(10, "na"), observation(6, "eu"), observation(7, "sa", "Sting")], now);
  expect(availableChannels(slots, selection)).toEqual([1, 2, 3, 5, 10]);
  expect(availableChannels(slots, selection, "sa", "Dark Fortress")).toEqual([1, 2, 3, 5]);
  expect(availableChannels(slots, selection, "na")).toEqual([1, 2, 3, 10]);
  expect(availableChannels([], selection)).toEqual([1, 2, 3]);
});
test("extra channels require explicit PvP evidence and bounded integer IDs", () => {
  for (const patch of [{ channel: 5 }, { channel: 5, pvp: false }, { channel: 0, pvp: true }, { channel: 1.5, pvp: true }, { channel: MAX_CHANNEL + 1, pvp: true }]) expect(() => parseSlot({ mobId: "NightmarePaladinBoss", region: "sa", ...patch })).toThrow();
  expect(parseSlot(observation(10))).toMatchObject({ channel: 10, pvp: true });
});
