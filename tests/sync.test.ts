import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync, readFileSync, mkdirSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { TimerStore } from "../src/backend/timer-store";
import { SyncCoordinator, connectionId, type SyncClock, type SyncTransport } from "../src/backend/sync-coordinator";
import { defaultSelection } from "../src/domain/catalog";
import { emptySlot, mergeObservations, slotKey, type Observation, type TimerSlot } from "../src/domain/timers";
import { applySync, pendingUploads } from "../src/domain/sync";
import type { Connection, Dataset, Discovery, SyncInput, SyncResult, PruneResult } from "../src/shared/sharing";
const roots: string[] = [], engines: SyncCoordinator[] = [];
const now = Date.UTC(2026, 8, 11, 18), config = { url: "https://test-sync.convex.cloud" };
const o = (id: string, patch: Partial<Observation> = {}): Observation => ({ mobId: "NightmarePaladinBoss", region: "sa", channel: 1, observationId: id, diedAt: now - 600000, gatheredAt: now - 1000, source: "manual", timePrecision: "second", ...patch });
class Clock implements SyncClock {
  time = now; next = 0; jobs = new Map<number, { at: number; callback: () => void }>();
  now = () => this.time;
  set(callback: () => void, ms: number) { const id = ++this.next; this.jobs.set(id, { at: this.time + ms, callback }); return id; }
  clear(handle: unknown) { this.jobs.delete(handle as number); }
  async advance(ms: number, engine: SyncCoordinator) {
    this.time += ms;
    for (const [id, job] of [...this.jobs]) if (job.at <= this.time) { this.jobs.delete(id); job.callback(); await engine.settled(); }
  }
}
class Transport implements SyncTransport {
  config = { ...config }; calls: SyncInput[] = []; rows: TimerSlot[] = []; dataset: Dataset = { datasetId: "dataset", generation: 1, revision: 0, resetAt: 0 };
  hold?: Promise<void>; error?: Error; resets: string[] = []; lostReset = false; receipts = new Map<string, Dataset>();
  constructor(public clock: Clock) {}
  credentials = (): Connection => ({ ...this.config }); close() {}
  async discover(): Promise<Discovery> { return { app: "mvp-tracker", protocol: 2, schema: 1, catalog: 1, dataset: { ...this.dataset }, serverTime: this.clock.now() }; }
  async sync(input: SyncInput): Promise<SyncResult> {
    this.calls.push(structuredClone(input)); await this.hold;
    if (this.error) throw this.error;
    if (input.generation !== this.dataset.generation) throw new Error("Sharing: The dataset changed or was reset. Test the connection again before syncing.");
    const merged = mergeObservations(this.rows, input.observations, this.clock.now());
    if (JSON.stringify(merged) !== JSON.stringify(this.rows)) this.dataset.revision++;
    this.rows = merged;
    return { dataset: { ...this.dataset }, full: input.sinceRevision === null, serverTime: this.clock.now(), acknowledged: input.observations.map(o => o.observationId),
      slots: input.sinceRevision === this.dataset.revision ? [] : this.rows.map(r => ({ ...r, revision: this.dataset.revision })) };
  }
  async reset(expected: Dataset, id: string): Promise<Dataset> {
    this.resets.push(id); if (this.receipts.has(id)) return this.receipts.get(id)!;
    if (expected.generation !== this.dataset.generation) throw new Error("Sharing: The dataset changed or was reset.");
    this.rows = []; this.dataset = { ...this.dataset, generation: this.dataset.generation + 1, revision: this.dataset.revision + 1, resetAt: this.clock.now() };
    this.receipts.set(id, { ...this.dataset });
    if (this.lostReset) { this.lostReset = false; throw new Error("Sharing: Could not reach Convex. Retry."); }
    return { ...this.dataset };
  }
  prunes = 0;
  async prune(expected: Dataset): Promise<PruneResult> {
    this.prunes++; await this.hold; if (this.error) throw this.error;
    if (expected.generation !== this.dataset.generation) throw new Error("Sharing: dataset changed.");
    const before = this.rows.length;
    this.rows = this.rows.filter(r => r.observation ? r.observation.diedAt + 9000000 > this.clock.now() : !r.outdated);
    if (before !== this.rows.length) this.dataset.revision++;
    return { dataset: { ...this.dataset }, serverTime: this.clock.now(), full: true, pruneOutdated: true, slots: this.rows.map(r => ({ ...r, revision: this.dataset.revision })), acknowledged: [], removed: before - this.rows.length };
  }
}
function fixture() {
  const root = mkdtempSync(join(tmpdir(), "mvp-sync-test-")); roots.push(root);
  const clock = new Clock(), transport = new Transport(clock), store = new TimerStore(root, defaultSelection(), clock.now);
  let sender: string | undefined = "First character";
  const engine = new SyncCoordinator(transport, store, defaultSelection, () => sender, undefined, undefined, 60, clock, () => 0); engines.push(engine);
  return { root, clock, transport, store, engine, sender: (name?: string) => { sender = name; } };
}
afterEach(() => {
  for (const engine of engines.splice(0)) engine.close();
  for (const root of roots.splice(0)) { if (!root.startsWith(join(tmpdir(), "mvp-sync-test-"))) throw new Error("Unsafe cleanup."); rmSync(root, { recursive: true, force: true }); }
});
test("sync persists observations and acknowledgement together; restart sends no duplicate upload", async () => {
  const { engine, store, transport, root, clock } = fixture(); store.ingest([o("local")]); engine.request(); await engine.settled();
  expect(transport.rows[0]?.observation?.observationId).toBe("local");
  const persisted = JSON.parse(readFileSync(store.file, "utf8")); expect(persisted.sync.known[slotKey(o("local"))]).toBe("local"); expect(persisted.slots[0].observation.observationId).toBe("local");
  const restarted = new TimerStore(root, defaultSelection(), clock.now); expect(pendingUploads(restarted.snapshot(), restarted.syncState(), defaultSelection(), now)).toEqual([]);
  engine.request(); await engine.settled(); expect(transport.calls.at(-1)?.observations).toEqual([]); expect(transport.calls.at(-1)?.sinceRevision).toBe(transport.dataset.revision);
  expect(readFileSync(store.file, "utf8")).toBe(JSON.stringify(persisted) + "\n");
});
test("manual clicks coalesce and capture during upload stays pending; sender is snapshotted", async () => {
  const { engine, store, transport, clock, sender } = fixture(); engine.request(); await engine.settled();
  store.ingest([o("before")]); let release!: () => void; transport.hold = new Promise(r => { release = r; });
  engine.start(); const count = transport.calls.length;
  sender("Second character"); store.ingest([o("during", { gatheredAt: now })]); engine.request(); engine.request(); engine.request();
  expect(engine.snapshot().queued).toBe(true); expect(transport.calls).toHaveLength(count);
  release(); await engine.settled(); expect(store.snapshot()[0]?.observation?.observationId).toBe("during");
  await clock.advance(0, engine); expect(transport.calls).toHaveLength(count + 1);
  expect(transport.calls[count - 1]?.sentByCharacter).toBe("First character"); expect(transport.calls.at(-1)?.sentByCharacter).toBe("Second character"); expect(transport.calls.at(-1)?.observations[0]?.observationId).toBe("during");
});
test("interval changes rebase the timer, Stop cancels scheduled work and sleep produces one catch-up", async () => {
  const { engine, clock, transport } = fixture(); engine.start(); await engine.settled();
  engine.setInterval(20); expect(engine.snapshot().nextAt).toBe(now + 20000);
  const count = transport.calls.length; await clock.advance(600000, engine); expect(transport.calls).toHaveLength(count + 1);
  expect(clock.jobs.size).toBe(1); engine.stop(); expect(clock.jobs.size).toBe(0); await clock.advance(600000, engine); expect(transport.calls).toHaveLength(count + 1);
  engine.request(); await engine.settled(); expect(transport.calls).toHaveLength(count + 2); expect(engine.snapshot().running).toBe(false);
});
test("changing interval or stopping during a request applies its reply without overlapping", async () => {
  const { engine, clock, transport } = fixture(); engine.request(); await engine.settled();
  let release!: () => void; transport.hold = new Promise(r => { release = r; }); engine.start(); engine.setInterval(10);
  expect(clock.jobs.size).toBe(0); release(); await engine.settled(); expect(engine.snapshot().nextAt).toBe(now + 10000);
  transport.hold = new Promise(r => { release = r; }); engine.request(); engine.stop(); release(); await engine.settled(); expect(engine.snapshot().running).toBe(false); expect(clock.jobs.size).toBe(0);
});
test("network backoff and permanent errors do not schedule unlimited retries", async () => {
  const { engine, transport, clock } = fixture(); engine.request(); await engine.settled();
  transport.error = new Error("Sharing: Could not reach Convex. Retry."); engine.start(); await engine.settled();
  expect(engine.snapshot().phase).toBe("backoff"); expect(clock.jobs.size).toBe(1);
  transport.error = new Error("Sharing: Install matching MVP Tracker backend functions."); await clock.advance(60000, engine);
  expect(engine.snapshot().running).toBe(false); expect(engine.snapshot().phase).toBe("paused"); expect(clock.jobs.size).toBe(0);
});
test("a changed connection discards a late response and keeps local timers", async () => {
  const { engine, transport, store } = fixture(); engine.request(); await engine.settled(); store.ingest([o("local")]);
  let release!: () => void; transport.hold = new Promise(r => { release = r; }); engine.request();
  transport.config = { ...config, url: "https://another-group.convex.cloud" }; engine.connectionChanged(); release(); await engine.settled();
  expect(store.snapshot()[0]?.observation?.observationId).toBe("local"); expect(store.syncState()?.connectionId).toBe(connectionId(config)); expect(engine.snapshot().running).toBe(false);
});
test("reset retries a persisted request ID after a lost response and leaves auto-sync stopped", async () => {
  const { engine, transport, store, root, clock } = fixture(); store.ingest([o("old")]); engine.start(); await engine.settled();
  transport.lostReset = true; await expect(engine.reset(transport.dataset)).rejects.toThrow();
  expect(new TimerStore(root, defaultSelection(), clock.now).syncState()?.resetRequest?.id).toBe(transport.resets[0]);
  engine.request(); await engine.settled(); expect(transport.resets[1]).toBe(transport.resets[0]);
  expect(store.snapshot()[0]?.observation).toBeUndefined(); expect(engine.snapshot().running).toBe(false); expect(engine.snapshot().resetPending).toBe(false);
});

test("confirmed reset works after connection testing without uploading local data first", async () => {
  const { engine, transport, store } = fixture(); store.ingest([o("local")]);
  await engine.reset(transport.dataset);
  expect(transport.calls).toHaveLength(0); expect(transport.resets).toHaveLength(1);
  expect(store.snapshot()[0]?.observation).toBeUndefined(); expect(engine.snapshot().running).toBe(false);
  const other = fixture();
  await expect(other.engine.reset({ ...other.transport.dataset, datasetId: "different" })).rejects.toThrow();
  expect(other.transport.resets).toHaveLength(0);
});

test("a manual sync for a changed connection waits for the old request to drain", async () => {
  const { engine, transport, store, clock } = fixture(); engine.request(); await engine.settled();
  let release!: () => void; transport.hold = new Promise(r => { release = r; }); engine.request();
  transport.config = { ...config, url: "https://another-group.convex.cloud" }; engine.connectionChanged(); engine.request();
  expect(engine.snapshot().queued).toBe(true); release(); await engine.settled();
  expect(store.syncState()?.connectionId).toBe(connectionId(config));
  await clock.advance(0, engine);
  expect(store.syncState()?.connectionId).toBe(connectionId(transport.config));
  expect(engine.snapshot().queued).toBe(false); expect(engine.snapshot().running).toBe(false);
});

test("a failed durable reset checkpoint never sends the reset; another player's reset is recovered", async () => {
  const { engine, transport, store } = fixture(); engine.request(); await engine.settled();
  mkdirSync(`${store.file}.tmp`);
  await expect(engine.reset(transport.dataset)).rejects.toThrow(); expect(transport.resets).toHaveLength(0);
  engine.request(); await engine.settled(); expect(transport.resets).toHaveLength(0);
  rmdirSync(`${store.file}.tmp`);
  transport.dataset = { ...transport.dataset, generation: 2, resetAt: now, revision: 1 };
  engine.request(); await engine.settled(); expect(engine.snapshot().resetPending).toBe(false); expect(engine.snapshot().running).toBe(false); expect(store.syncState()?.dataset.generation).toBe(2);
});
test("remote expired slots preserve newer local evidence and unselected slots are not ingested", () => {
  const local = o("new", { gatheredAt: now }), current = [{ ...emptySlot(local), observation: local }];
  const result: SyncResult = { dataset: { datasetId: "dataset", generation: 1, revision: 2, resetAt: 0 }, full: true, serverTime: now, acknowledged: [], slots: [{ ...emptySlot(local, true), revision: 1 }, { ...emptySlot({ ...local, region: "eu" }), observation: o("eu", { region: "eu" }), revision: 2 }] };
  const next = applySync(current, undefined, result, [], connectionId(config), "selected", defaultSelection(), now);
  expect(next.slots).toHaveLength(1); expect(next.slots[0]?.observation?.observationId).toBe("new");
  expect(() => applySync(current, undefined, { ...result, full: false }, [], connectionId(config), "selected", defaultSelection(), now)).toThrow();
});

test("delete outdated works locally without a connection and persists while preserving live records", async () => {
  const { engine, store, transport, root, clock } = fixture(); transport.config = { url: "" };
  store.ingest([o("old", { diedAt: now - 9000000 }), o("live", { channel: 2 })]);
  engine.requestPrune(); await engine.settled();
  expect(store.snapshot().map(s => s.observation?.observationId)).toEqual(["live"]);
  expect(new TimerStore(root, defaultSelection(), clock.now).snapshot()).toHaveLength(1);
  expect(transport.prunes).toBe(0); expect(engine.snapshot().message).toContain("No database configured");
});

test("cleanup waits for sync and preserves fresh capture arriving while the database request is active", async () => {
  const { engine, store, transport, clock } = fixture(); engine.request(); await engine.settled();
  store.ingest([o("old", { diedAt: now - 9000000 })]); transport.rows = [emptySlot(o("old"), true)];
  let release!: () => void; transport.hold = new Promise(r => { release = r; }); engine.request(); engine.requestPrune();
  expect(transport.prunes).toBe(0); release(); await engine.settled();
  transport.hold = new Promise(r => { release = r; });
  const cleaning = clock.advance(0, engine); await Promise.resolve();
  expect(transport.prunes).toBe(1); store.ingest([o("fresh", { gatheredAt: now })]); release(); await cleaning;
  expect(store.snapshot()[0]?.observation?.observationId).toBe("fresh"); expect(transport.rows).toHaveLength(0);
  expect(pendingUploads(store.snapshot(), store.syncState(), defaultSelection(), now)).toHaveLength(1);
});

test("a shared prune removes obsolete local labels and never clears current local observations", () => {
  const active = o("active", { channel: 2 });
  const result: SyncResult = { dataset: { datasetId: "dataset", generation: 1, revision: 3, resetAt: 0 }, full: true, pruneOutdated: true, serverTime: now, slots: [], acknowledged: [] };
  const applied = applySync([emptySlot(o("old"), true), { ...emptySlot(active), observation: active }], undefined, result, [], connectionId(config), "selected", defaultSelection(), now);
  expect(applied.slots).toHaveLength(1); expect(applied.slots[0]?.observation?.observationId).toBe("active");
});

test("cleanup on a new connection does not upload local records or restore remote placeholders on failure", async () => {
  const { engine, store, transport } = fixture();
  store.ingest([o("old", { diedAt: now - 9000000 })]); transport.rows = [emptySlot(o("old"), true)];
  transport.error = new Error("Sharing: Could not reach Convex. Retry."); engine.requestPrune(); await engine.settled();
  expect(transport.calls).toHaveLength(0); expect(store.snapshot()).toEqual([]);
  expect(engine.snapshot().message).toContain("database cleanup failed");
  transport.error = undefined; engine.requestPrune(); await engine.settled();
  expect(transport.rows).toEqual([]); expect(transport.calls).toHaveLength(0);
});
