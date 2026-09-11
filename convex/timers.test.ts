/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { EXPIRE_AFTER, MINUTE } from "../src/domain/time";
const modules = import.meta.glob(["./**/*.ts", "./**/*.js", "!./**/*.test.ts"]);
const key = "test_group_key_01234567890123456789", now = Date.UTC(2026, 8, 11, 18);
const access = { key, protocol: 1 };
const slot = { mobId: "NightmarePaladinBoss", region: "sa", channel: 2 };
const evidence = (id = "evidence", patch = {}) => ({ ...slot, observationId: id, diedAt: now - 70 * MINUTE, gatheredAt: now - MINUTE, source: "manual" as const, timePrecision: "second" as const, killedBy: "Killer", observedByCharacter: "Observer", ...patch });
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); vi.stubEnv("MVP_GROUP_KEY", key); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
async function setup() {
  const t = convexTest(schema, modules), d = await t.mutation(internal.timers.initialize, {});
  return { t, d, args: { ...access, datasetId: d.datasetId, generation: d.generation, sinceRevision: null, requestId: "request", sentByCharacter: "Sender", observations: [evidence()] } };
}
test("access fails closed, Test is read-only and initialization preserves the dataset", async () => {
  const t = convexTest(schema, modules);
  await expect(t.query(api.timers.testConnection, { ...access, key: "wrong" })).rejects.toThrow();
  vi.stubEnv("MVP_GROUP_KEY", ""); await expect(t.query(api.timers.testConnection, access)).rejects.toThrow(); vi.stubEnv("MVP_GROUP_KEY", key);
  expect((await t.query(api.timers.testConnection, access)).dataset).toBeNull();
  expect(await t.run(ctx => ctx.db.query("trackerMeta").collect())).toHaveLength(0);
  const d = await t.mutation(internal.timers.initialize, {});
  expect(await t.mutation(internal.timers.initialize, {})).toEqual(d);
  await expect(t.query(api.timers.testConnection, { ...access, protocol: 99 })).rejects.toThrow();
  await t.run(async ctx => { const m = (await ctx.db.query("trackerMeta").first())!; await ctx.db.patch(m._id, { schema: 99 }); });
  await expect(t.query(api.timers.testConnection, access)).rejects.toThrow();
});
test("transaction merge preserves unselected slots, stamps sender once and returns cheap deltas", async () => {
  const { t, args } = await setup();
  const first = await t.mutation(api.timers.sync, { ...args, observations: [evidence(), evidence("na", { region: "na" })] });
  expect(first.slots).toHaveLength(2);
  expect(first.slots[0]?.observation?.submission).toEqual({ submittedByCharacter: "Sender", serverAcceptedAt: now });
  const again = await t.mutation(api.timers.sync, { ...args, sinceRevision: first.dataset.revision, sentByCharacter: "Forwarder" });
  expect(again.dataset.revision).toBe(first.dataset.revision); expect(again.slots).toEqual([]);
  const fresh = evidence("fresh", { gatheredAt: now, diedAt: now - 80 * MINUTE, killedBy: "Different" });
  const delta = await t.mutation(api.timers.sync, { ...args, sinceRevision: first.dataset.revision, observations: [fresh] });
  expect(delta.full).toBe(false); expect(delta.slots).toHaveLength(1); expect(delta.slots[0]?.observation?.killedBy).toBe("Different");
  const pull = await t.query(api.timers.snapshot, { ...access, datasetId: args.datasetId, generation: args.generation }); expect(pull.slots).toHaveLength(2);
});
test("invalid batches are atomic and missing sender allows only pulls", async () => {
  const { t, args } = await setup();
  await expect(t.mutation(api.timers.sync, { ...args, key: "wrong" })).rejects.toThrow();
  await expect(t.query(api.timers.snapshot, { ...access, key: "wrong", datasetId: args.datasetId, generation: 1 })).rejects.toThrow();
  await expect(t.mutation(api.timers.reset, { ...access, key: "wrong", datasetId: args.datasetId, generation: 1, requestId: "bad-reset" })).rejects.toThrow();
  for (const patch of [{ channel: 4 }, { mobId: "Dragon Predator Robot" }, { gatheredAt: now + MINUTE }, { killedBy: "bad\nname" }]) {
    await expect(t.mutation(api.timers.sync, { ...args, observations: [evidence("good"), evidence("bad", patch)] })).rejects.toThrow();
  }
  await expect(t.mutation(api.timers.sync, { ...args, sentByCharacter: undefined })).rejects.toThrow();
  expect((await t.mutation(api.timers.sync, { ...args, observations: [], sentByCharacter: undefined })).slots).toEqual([]);
  await t.mutation(api.timers.sync, args);
  await expect(t.mutation(api.timers.sync, { ...args, observations: [evidence("evidence", { channel: 1 })] })).rejects.toThrow();
  expect((await t.query(api.timers.snapshot, { ...access, datasetId: args.datasetId, generation: args.generation })).slots).toHaveLength(1);
});
test("ties converge, supplied attribution cannot impersonate server acceptance, and stale input cannot clear", async () => {
  const { t, args } = await setup();
  const winner = evidence("z", { submission: { submittedByCharacter: "Forged", serverAcceptedAt: 1 } });
  await t.mutation(api.timers.sync, { ...args, observations: [winner, evidence("a")] });
  const response = await t.mutation(api.timers.sync, { ...args, observations: [evidence("stale", { diedAt: now - EXPIRE_AFTER, gatheredAt: now })] });
  expect(response.slots[0]?.observation?.observationId).toBe("z");
  expect(response.slots[0]?.observation?.submission?.submittedByCharacter).toBe("Sender");
});
test("expiry produces a cleared delta and removes personal payloads; read-only snapshots do not write", async () => {
  const { t, args } = await setup(); const first = await t.mutation(api.timers.sync, args);
  vi.setSystemTime(now + EXPIRE_AFTER);
  const read = await t.query(api.timers.snapshot, { ...access, datasetId: args.datasetId, generation: args.generation }); expect(read.slots[0]?.observation).toBeUndefined();
  expect((await t.run(ctx => ctx.db.query("bossTimers").first()))?.observation).toBeDefined();
  const cleared = await t.mutation(api.timers.sync, { ...args, observations: [], sinceRevision: first.dataset.revision });
  expect(cleared.slots[0]?.outdated).toBe(true); expect(cleared.slots[0]?.observation).toBeUndefined();
  expect((await t.run(ctx => ctx.db.query("bossTimers").first()))?.observation).toBeUndefined();
});
test("reset rejects old generations, blocks old death reports and retry cannot erase new data", async () => {
  const { t, args } = await setup(); await t.mutation(api.timers.sync, args);
  const resetArgs = { ...access, datasetId: args.datasetId, generation: args.generation, requestId: "reset-1" };
  const reset = await t.mutation(api.timers.reset, resetArgs);
  await expect(t.mutation(api.timers.sync, args)).rejects.toThrow();
  const after = { ...args, generation: reset.generation };
  expect((await t.mutation(api.timers.sync, after)).slots).toEqual([]);
  vi.setSystemTime(now + MINUTE);
  await t.mutation(api.timers.sync, { ...after, observations: [evidence("new-death", { diedAt: now + 1000, gatheredAt: now + MINUTE })] });
  expect(await t.mutation(api.timers.reset, resetArgs)).toEqual(reset);
  expect((await t.query(api.timers.snapshot, { ...access, datasetId: after.datasetId, generation: after.generation })).slots).toHaveLength(1);
  let generation = reset.generation;
  for (let i = 0; i < 35; i++) { const r = await t.mutation(api.timers.reset, { ...resetArgs, generation, requestId: `reset-${i + 2}` }); generation = r.generation; }
  expect(await t.run(ctx => ctx.db.query("resetReceipts").collect())).toHaveLength(32);
  await expect(t.mutation(api.timers.reset, resetArgs)).rejects.toThrow();
});
