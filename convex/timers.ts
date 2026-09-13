import { v, ConvexError } from "convex/values";
import { query, mutation, internalMutation, type QueryCtx, type MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { observation } from "./schema";
import { CATALOG_VERSION } from "../src/domain/catalog";
import { observationStart, observationExpiresAt, compareEvidence, evidenceContent, MAX_SLOTS, parseObservation, parseSlot, slotKey } from "../src/domain/timers";
import { SHARING_PROTOCOL, SHARING_SCHEMA, type Dataset, type Discovery, type SharedSlot, type SyncResult } from "../src/shared/sharing";

function fail(code: string): never { throw new ConvexError({ code }); }
function checkProtocol(protocol: number) {
  if (protocol !== SHARING_PROTOCOL) fail("VERSION");
}
async function meta(ctx: QueryCtx) {
  const m = await ctx.db.query("trackerMeta").withIndex("by_singleton", q => q.eq("singleton", "tracker")).unique();
  if (m && (m.schema !== SHARING_SCHEMA || m.catalog !== CATALOG_VERSION)) fail("VERSION");
  return m;
}
function dataset(m: Doc<"trackerMeta">): Dataset { return { datasetId: m.datasetId, generation: m.generation, revision: m.revision, resetAt: m.resetAt }; }
async function bound(ctx: QueryCtx, id: string, generation: number) {
  const m = await meta(ctx);
  if (!m) fail("NOT_INITIALIZED");
  if (m.datasetId !== id || m.generation !== generation) fail("GENERATION");
  return m;
}
function requestId(id: string) { if (!/^[A-Za-z0-9_-]{1,80}$/.test(id)) fail("INVALID_BATCH"); }
function publicSlot(row: Doc<"bossTimers">, now: number): SharedSlot {
  const active = row.observation && row.expiresAt! > now;
  return { ...parseSlot(row), outdated: row.outdated || !!row.observation && !active, revision: row.revision, ...(active ? { observation: row.observation as ReturnType<typeof parseObservation> } : {}) };
}
async function result(ctx: QueryCtx, m: Doc<"trackerMeta">, since: number | null, now: number, acknowledged: string[] = []): Promise<SyncResult> {
  const pruneOutdated = m.prunedRevision !== undefined && (since === null || since < m.prunedRevision);
  const full = since === null || since > m.revision || pruneOutdated;
  const rows = !full && since === m.revision ? [] : full ? await ctx.db.query("bossTimers").take(MAX_SLOTS + 1) : await ctx.db.query("bossTimers").withIndex("by_revision", q => q.gt("revision", since!)).take(MAX_SLOTS + 1);
  if (rows.length > MAX_SLOTS) fail("CAPACITY");
  return { dataset: dataset(m), serverTime: now, full, slots: rows.map(r => publicSlot(r, now)), acknowledged, ...(pruneOutdated ? { pruneOutdated: true } : {}) };
}
export const testConnection = query({ args: { protocol: v.number() }, handler: async (ctx, args): Promise<Discovery> => {
  checkProtocol(args.protocol); const m = await meta(ctx);
  return { app: "mvp-tracker", protocol: SHARING_PROTOCOL, schema: SHARING_SCHEMA, catalog: CATALOG_VERSION, serverTime: Date.now(), dataset: m ? dataset(m) : null };
} });
async function initializeDataset(ctx: MutationCtx): Promise<Dataset> {
  const existing = await meta(ctx); if (existing) return dataset(existing);
  const id = await ctx.db.insert("trackerMeta", { singleton: "tracker", schema: SHARING_SCHEMA, catalog: CATALOG_VERSION, datasetId: "initializing", generation: 1, resetAt: 0, revision: 0 });
  await ctx.db.patch(id, { datasetId: String(id) }); return dataset((await ctx.db.get(id))!);
}
export const initialize = internalMutation({ args: {}, handler: initializeDataset });
export const ensureInitialized = mutation({ args: { protocol: v.number() }, handler: async (ctx, args): Promise<Dataset> => {
  checkProtocol(args.protocol); return initializeDataset(ctx);
} });
export const snapshot = query({ args: { protocol: v.number(), datasetId: v.string(), generation: v.number() }, handler: async (ctx, args): Promise<SyncResult> => {
  checkProtocol(args.protocol); return result(ctx, await bound(ctx, args.datasetId, args.generation), null, Date.now());
} });
async function expire(ctx: MutationCtx, m: Doc<"trackerMeta">, now: number) {
  if (m.nextExpiry === undefined || m.nextExpiry > now) return;
  const due = await ctx.db.query("bossTimers").withIndex("by_expiry", q => q.gt("expiresAt", 0).lte("expiresAt", now)).take(MAX_SLOTS + 1);
  if (due.length > MAX_SLOTS) fail("CAPACITY");
  if (due.length) m.revision++;
  for (const row of due) await ctx.db.patch(row._id, { observation: undefined, expiresAt: undefined, outdated: true, revision: m.revision });
}
async function expiryMetadata(ctx: MutationCtx, m: Doc<"trackerMeta">) {
  const first = await ctx.db.query("bossTimers").withIndex("by_expiry", q => q.gt("expiresAt", 0)).first();
  if (first?.expiresAt !== m.nextExpiry || first && !m.cleanupJob) {
    if (m.cleanupJob) {
      const old = await ctx.db.system.get(m.cleanupJob);
      if (old?.state.kind === "pending") await ctx.scheduler.cancel(m.cleanupJob);
    }
    m.cleanupToken = (m.cleanupToken ?? 0) + 1;
    m.cleanupJob = first ? await ctx.scheduler.runAt(first.expiresAt!, internal.timers.cleanup, { generation: m.generation, token: m.cleanupToken }) : undefined;
  }
  m.nextExpiry = first?.expiresAt;
  await ctx.db.patch(m._id, { revision: m.revision, nextExpiry: m.nextExpiry, cleanupToken: m.cleanupToken, cleanupJob: m.cleanupJob });
}
export const cleanup = internalMutation({ args: { generation: v.number(), token: v.number() }, handler: async (ctx, args): Promise<void> => {
  const m = await meta(ctx); if (!m || m.generation !== args.generation || m.cleanupToken !== args.token) return;
  m.cleanupJob = undefined; await expire(ctx, m, Date.now()); await expiryMetadata(ctx, m);
} });
export const sync = mutation({ args: {
  protocol: v.number(), datasetId: v.string(), generation: v.number(), sinceRevision: v.union(v.number(), v.null()), requestId: v.string(), sentByCharacter: v.optional(v.union(v.string(), v.null())), observations: v.array(observation),
}, handler: async (ctx, args): Promise<SyncResult> => {
  checkProtocol(args.protocol); const m = await bound(ctx, args.datasetId, args.generation); requestId(args.requestId);
  const now = Date.now(), before = m.revision;
  if (args.sinceRevision !== null && (!Number.isSafeInteger(args.sinceRevision) || args.sinceRevision < 0) || args.observations.length > MAX_SLOTS || JSON.stringify(args.observations).length > 512000) fail("INVALID_BATCH");
  const sender = args.sentByCharacter?.trim();
  if (sender && (sender.length > 80 || /[\u0000-\u001f\u007f]/.test(sender))) fail("CHARACTER_REQUIRED");
  let incoming: ReturnType<typeof parseObservation>[];
  try { incoming = args.observations.map(raw => parseObservation({ ...raw, submission: undefined }, now)); } catch { fail("INVALID_BATCH"); }
  const ids = new Map<string, string>();
  for (const o of incoming) {
    const content = evidenceContent(o);
    if (ids.has(o.observationId) && ids.get(o.observationId) !== content) fail("CONFLICTING_ID");
    ids.set(o.observationId, content);
    const known = await ctx.db.query("bossTimers").withIndex("by_observation", q => q.eq("observation.observationId", o.observationId)).unique();
    if (known?.observation && evidenceContent(known.observation as typeof o) !== content) fail("CONFLICTING_ID");
  }
  await expire(ctx, m, now);
  for (const o of incoming) {
    if (observationExpiresAt(o) <= now || observationStart(o) <= m.resetAt) continue;
    const key = slotKey(o), old = await ctx.db.query("bossTimers").withIndex("by_slot", q => q.eq("key", key)).unique();
    if (old?.observation && compareEvidence(o, old.observation as typeof o) <= 0) continue;
    m.revision = before + 1;
    const fields = { key, ...parseSlot(o), observation: { ...o, submission: { submittedByCharacter: sender || null, serverAcceptedAt: now } }, outdated: false, revision: m.revision, expiresAt: observationExpiresAt(o) };
    if (old) await ctx.db.patch(old._id, fields); else await ctx.db.insert("bossTimers", fields);
  }
  if (m.revision !== before || m.nextExpiry !== undefined && !m.cleanupJob) await expiryMetadata(ctx, m);
  return result(ctx, m, args.sinceRevision, now, [...ids.keys()]);
} });
export const pruneOutdated = mutation({ args: { protocol: v.number(), datasetId: v.string(), generation: v.number() }, handler: async (ctx, args) => {
  checkProtocol(args.protocol); const m = await bound(ctx, args.datasetId, args.generation), now = Date.now();
  const rows = await ctx.db.query("bossTimers").take(MAX_SLOTS + 1); if (rows.length > MAX_SLOTS) fail("CAPACITY");
  // Recheck actual evidence in this transaction; never trust a stale client list or outdated flag on a live observation.
  const expired = rows.filter(row => row.observation ? observationExpiresAt(row.observation) <= now : row.outdated);
  for (const row of expired) await ctx.db.delete(row._id);
  if (expired.length) {
    m.revision++; m.prunedRevision = m.revision;
    await ctx.db.patch(m._id, { prunedRevision: m.prunedRevision }); await expiryMetadata(ctx, m);
  }
  return { ...await result(ctx, m, null, now), pruneOutdated: true, removed: expired.length };
} });
export const reset = mutation({ args: { protocol: v.number(), datasetId: v.string(), generation: v.number(), requestId: v.string() }, handler: async (ctx, args): Promise<Dataset> => {
  checkProtocol(args.protocol); requestId(args.requestId);
  const m = await meta(ctx); if (!m) fail("NOT_INITIALIZED"); if (m.datasetId !== args.datasetId) fail("GENERATION");
  const receipt = await ctx.db.query("resetReceipts").withIndex("by_request", q => q.eq("requestId", args.requestId)).unique();
  if (receipt) {
    if (receipt.datasetId !== args.datasetId || receipt.expectedGeneration !== args.generation) fail("GENERATION");
    return { datasetId: receipt.datasetId, generation: receipt.generation, revision: receipt.revision, resetAt: receipt.resetAt };
  }
  if (m.generation !== args.generation) fail("GENERATION");
  const rows = await ctx.db.query("bossTimers").take(MAX_SLOTS + 1); if (rows.length > MAX_SLOTS) fail("CAPACITY");
  for (const row of rows) await ctx.db.delete(row._id);
  m.generation++; m.revision++; m.resetAt = Date.now();
  if (m.cleanupJob) { const old = await ctx.db.system.get(m.cleanupJob); if (old?.state.kind === "pending") await ctx.scheduler.cancel(m.cleanupJob); }
  await ctx.db.patch(m._id, { generation: m.generation, revision: m.revision, resetAt: m.resetAt, nextExpiry: undefined, cleanupJob: undefined, cleanupToken: (m.cleanupToken ?? 0) + 1 });
  await ctx.db.insert("resetReceipts", { requestId: args.requestId, expectedGeneration: args.generation, ...dataset(m) });
  const receipts = await ctx.db.query("resetReceipts").withIndex("by_time").order("desc").take(33);
  for (const old of receipts.slice(32)) await ctx.db.delete(old._id);
  return dataset(m);
} });
