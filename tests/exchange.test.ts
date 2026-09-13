import { expect, test } from "bun:test";
import { gzipSync, gunzipSync } from "node:zlib";
import { decodeImport, exportTimers, previewImport } from "../src/backend/exchange";
import { defaultSelection, bossPreset } from "../src/domain/catalog";
import { mergeObservations, type Observation, type TimerSlot } from "../src/domain/timers";
import { EXCHANGE_LIMIT } from "../src/shared/exchange";
const now = Date.UTC(2026, 8, 11, 4);
function observation(id: string, patch: Partial<Observation> = {}): Observation {
  return { mobId: "NightmarePaladinBoss", region: "sa", channel: 1, observationId: id, diedAt: now - 600000, gatheredAt: now - 1000,
    source: "manual", timePrecision: "second", killedBy: "Luís 🐉", observedByCharacter: "Observer", ...patch };
}
const slots = (observations: Observation[]): TimerSlot[] => observations.map(o => ({ mobId: o.mobId, region: o.region, channel: o.channel, outdated: false, observation: o }));
const all = { ...defaultSelection(), bossIds: bossPreset("all") };

test("text is selected Dark Fortress kill time, sorted across midnight, with empty groups omitted", () => {
  const data = slots([observation("a", { diedAt: Date.UTC(2026, 8, 11, 2, 55) }), observation("b", { mobId: "NightmareShinobiBoss", diedAt: Date.UTC(2026, 8, 11, 3, 5) }), observation("w", { mobId: "NightmareWeaverBoss" }), observation("old", { channel: 2, diedAt: now - 151 * 60000 })]);
  expect(exportTimers(data, all, now, "text")).toEqual({ count: 2, text: "SA UTC-3\nCh1: 23:55(pa) - 00:05(s)" });
  expect(exportTimers(data, { bossIds: [], regions: [] }, now, "text")).toEqual({ count: 0, text: "" });
});

test("JSON/compressed round trip keeps UTF-8 evidence and two users converge without freshness inflation", () => {
  const a = observation("a"), b = observation("b", { channel: 2 });
  let first = slots([a]), second = slots([b]);
  for (const format of ["json", "compressed"] as const) {
    const exported = exportTimers(first, defaultSelection(), now, format);
    const incoming = decodeImport("\uFEFF \n" + exported.text + "\n", now);
    expect(incoming).toEqual(first.map(s => s.observation!));
    second = mergeObservations(second, previewImport(second, incoming, defaultSelection(), now).observations, now);
    first = mergeObservations(first, decodeImport(exportTimers(second, defaultSelection(), now, format).text, now), now);
  }
  expect(first).toEqual(second);
  const incoming = decodeImport(exportTimers(first, all, now, "json").text, now);
  expect(previewImport(first, incoming, all, now).summary).toMatchObject({ added: 0, refreshed: 0, ignored: 2 });
  expect(first[0]!.observation!.gatheredAt).toBe(a.gatheredAt);
});

test("server attribution survives JSON and compressed sharing without changing evidence identity", () => {
  const original = observation("attributed"), attributed = { ...original, submission: { submittedByCharacter: "Forwarder", serverAcceptedAt: now } };
  for (const format of ["json", "compressed"] as const) {
    const decoded = decodeImport(exportTimers(slots([attributed]), all, now, format).text, now);
    const merged = mergeObservations(slots([original]), decoded, now);
    expect(merged[0]?.observation?.submission).toEqual(attributed.submission);
    expect(merged[0]?.observation?.gatheredAt).toBe(original.gatheredAt);
  }
});

test("preview does not mutate, counts disabled/expired/conflicts, and confirmation uses fresher local data", () => {
  const a = observation("a"), replacement = observation("z"); const current = slots([a]); const before = JSON.stringify(current);
  const pending = previewImport(current, [replacement, observation("disabled", { region: "eu" }), observation("expired", { channel: 2, diedAt: now - 151 * 60000 })], defaultSelection(), now);
  expect(pending.summary).toMatchObject({ refreshed: 1, disabled: 1, expired: 1, conflicted: 1 });
  expect(JSON.stringify(current)).toBe(before);
  const fresh = slots([observation("fresh", { gatheredAt: now })]);
  expect(previewImport(fresh, [replacement], defaultSelection(), now).observations).toEqual([]);
  expect(() => previewImport(current, [observation("a", { killedBy: "Altered" })], all, now)).toThrow("conflicting");
});

test("invalid schemas, text, dates, channels, IDs, deep nesting and corrupt gzip reject before merging", () => {
  const json = exportTimers(slots([observation("a")]), all, now, "json").text;
  const value = JSON.parse(json);
  for (const patch of [{ schemaVersion: 99 }, { observations: [observation("a", { channel: 4 as 1 })] }, { observations: [observation("a", { mobId: "Dragon Predator Robot" as Observation["mobId"] })] }, { observations: [observation("a", { gatheredAt: now + 60000 })] }, { observations: [observation("a"), observation("a", { killedBy: "other" })] }]) expect(() => decodeImport(JSON.stringify({ ...value, ...patch }), now)).toThrow();
  for (const input of ["SA UTC-3\nCh1: 12:00(pa)", "MVPT2:abc", "MVPT1:@!", '{"nested":' + "[".repeat(10) + "0" + "]".repeat(10) + "}", "x".repeat(EXCHANGE_LIMIT + 1)]) expect(() => decodeImport(input, now)).toThrow();
  const bytes = gzipSync(Buffer.from(json)); bytes[bytes.length - 8] ^= 1;
  expect(() => decodeImport("MVPT1:" + bytes.toString("base64url"), now)).toThrow("corrupt");
});

test("bundled zlib enforces expansion limit and exports strip unrelated private fields", () => {
  const bomb = gzipSync(Buffer.alloc(EXCHANGE_LIMIT + 1, 65));
  expect(() => gunzipSync(bomb, { maxOutputLength: EXCHANGE_LIMIT })).toThrow();
  expect(() => decodeImport("MVPT1:" + bomb.toString("base64url"), now)).toThrow("limit");
  const dirty = { ...observation("a"), groupKey: "SECRET", localPath: "SECRET", submittedByCharacter: "SECRET" };
  expect(exportTimers(slots([dirty]), all, now, "json").text).not.toContain("SECRET");
});
