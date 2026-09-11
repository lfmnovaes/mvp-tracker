import { createHash } from "node:crypto";
import type { Selection } from "../domain/catalog";
import { pendingUploads, validateSyncResult, type SyncCache } from "../domain/sync";
import { SHARING_PROTOCOL, type Connection, type Dataset, type Discovery, type SyncInput, type SyncResult, type PruneResult } from "../shared/sharing";
import type { TimerStore } from "./timer-store";
export const SYNC_INTERVALS = [10, 20, 30, 60, 120, 300] as const;
export interface SyncStatus { running: boolean; busy: boolean; queued: boolean; phase: "stopped" | "waiting" | "syncing" | "cleaning" | "backoff" | "paused" | "resetting"; interval: number; nextAt?: number; lastAt?: number; message: string; resetPending: boolean; dataset?: Dataset }
export interface SyncTransport {
  credentials(): Connection;
  discover(initialize?: boolean): Promise<Discovery>;
  sync(input: SyncInput): Promise<SyncResult>;
  reset(expected: Dataset, requestId: string): Promise<Dataset>;
  prune(expected: Dataset): Promise<PruneResult>;
  close(): void;
}
export interface SyncClock { now(): number; set(callback: () => void, ms: number): unknown; clear(handle: unknown): void }
const systemClock: SyncClock = { now: Date.now, set: (f, ms) => setTimeout(f, ms), clear: h => clearTimeout(h as ReturnType<typeof setTimeout>) };
export function connectionId(config: Connection) { return createHash("sha256").update(JSON.stringify(config)).digest("hex"); }
function selectionId(selection: Selection) { return JSON.stringify({ bossIds: [...selection.bossIds].sort(), regions: [...selection.regions].sort() }); }
export class SyncCoordinator {
  private state: SyncStatus;
  private timer?: unknown;
  private epoch = 0;
  private failures = 0;
  private task?: Promise<void>;
  private discovered = false;
  private resetting = false;
  private pruneRequested = false;
  constructor(private transport: SyncTransport, private store: TimerStore, private selection: () => Selection, private sender: () => string | undefined,
    private flush: () => void = () => {}, private changed: () => void = () => {}, interval = 60, private clock: SyncClock = systemClock, private jitter: () => number = Math.random) {
    this.state = { running: false, busy: false, queued: false, phase: "stopped", interval, message: "Sync stopped.", resetPending: !!this.cache()?.resetRequest };
  }
  snapshot(): SyncStatus { return { ...this.state, resetPending: !!this.cache()?.resetRequest, dataset: this.cache()?.dataset }; }
  private publish() { this.changed(); }
  private cancelTimer() { if (this.timer !== undefined) this.clock.clear(this.timer); this.timer = undefined; this.state.nextAt = undefined; }
  private schedule(ms: number) {
    this.cancelTimer(); const epoch = this.epoch; this.state.nextAt = this.clock.now() + ms;
    this.timer = this.clock.set(() => { if (epoch !== this.epoch || !this.state.running) return; this.timer = undefined; void this.run(); }, ms);
  }
  setInterval(seconds: number) {
    if (!SYNC_INTERVALS.includes(seconds as typeof SYNC_INTERVALS[number])) throw new Error("Sharing: invalid sync interval.");
    this.state.interval = seconds;
    if (this.state.running && !this.state.busy) this.schedule(seconds * 1000);
    this.publish();
  }
  start() { if (this.resetting) return; if (this.cache()?.resetRequest) { this.state.message = "A reset needs completion. Use Sync to retry it first."; this.publish(); return; } this.state.running = true; this.failures = 0; this.request(); }
  stop() { this.state.running = false; this.state.queued = false; this.cancelTimer(); if (!this.state.busy) this.state.phase = "stopped"; this.publish(); }
  request() {
    if (this.resetting) return;
    if (this.state.busy) { this.state.queued = true; this.publish(); return; }
    void this.run();
  }
  requestPrune() {
    if (this.resetting || this.cache()?.resetRequest) { this.state.message = "Finish the pending reset before deleting outdated entries."; this.publish(); return; }
    this.pruneRequested = true; this.request();
  }
  connectionChanged() {
    this.stop(); this.pruneRequested = false; this.epoch++; this.transport.close(); this.discovered = false;
    this.state.resetPending = false; this.state.message = "Connection changed. Sync stopped."; this.publish();
  }
  close() { this.connectionChanged(); }
  async settled() { await this.task; }
  private cache() { const cache = this.store.syncState(); return cache?.connectionId === connectionId(this.transport.credentials()) ? cache : undefined; }
  private async run() {
    if (this.state.busy) { this.state.queued = true; return; }
    const pruning = this.pruneRequested; this.pruneRequested = false;
    this.cancelTimer(); this.state.busy = true; this.state.phase = "syncing"; this.state.message = "Syncing…"; this.publish();
    const epoch = this.epoch;
    let removedLocal = 0;
    this.task = (async () => {
      try {
        if (pruning) {
          this.state.phase = "cleaning"; this.state.message = "Checking outdated entries…";
          this.flush(); removedLocal = this.store.pruneOutdated(); this.publish();
          if (!this.transport.credentials().url) { this.state.message = `Removed ${removedLocal} outdated locally. No database configured.`; return; }
        }
        if (!this.transport.credentials().url) throw new Error("Sharing: save a Convex URL first.");
        const id = connectionId(this.transport.credentials());
        let cache = this.cache();
        if (cache?.resetRequest) { await this.finishReset(cache, epoch); return; }
        if (!this.discovered || !cache) {
          const info = await this.transport.discover(true); if (epoch !== this.epoch) return;
          if (!info.dataset) throw new Error("Sharing: database initialization is unavailable. Deploy matching functions.");
          if (!cache || cache.dataset.datasetId !== info.dataset.datasetId || cache.dataset.generation !== info.dataset.generation) {
            if (pruning) cache = { connectionId: id, selection: "", dataset: info.dataset, known: {} };
            else {
            // The first request binds to current generation with no upload, preventing replay across Reset.
            const fresh = await this.transport.sync({ protocol: SHARING_PROTOCOL, datasetId: info.dataset.datasetId, generation: info.dataset.generation, sinceRevision: null, requestId: crypto.randomUUID(), observations: [], sentByCharacter: this.sender() ?? null });
            if (epoch !== this.epoch) return; this.flush(); this.store.acceptSync(fresh, [], id, selectionId(this.selection())); cache = this.cache();
            }
          }
          this.discovered = true;
        }
        if (!cache) throw new Error("Sharing: missing dataset metadata.");
        if (pruning) {
          const response = await this.transport.prune(cache.dataset); if (epoch !== this.epoch) return;
          if (!Number.isSafeInteger(response.removed) || response.removed < 0 || response.removed > 594 || !response.full || !response.pruneOutdated || response.dataset.datasetId !== cache.dataset.datasetId || response.dataset.generation !== cache.dataset.generation) throw new Error("Sharing: invalid cleanup response.");
          this.flush(); this.store.acceptSync(response, [], id, selectionId(this.selection()));
          this.failures = 0; this.state.lastAt = this.clock.now(); this.state.message = `Removed ${removedLocal} outdated locally and ${response.removed} from the database.`; return;
        }
        this.flush(); const selection = this.selection(), selected = selectionId(selection);
        const outgoing = pendingUploads(this.store.snapshot(), cache, selection, this.clock.now());
        const response = validateSyncResult(await this.transport.sync({ protocol: SHARING_PROTOCOL, datasetId: cache.dataset.datasetId, generation: cache.dataset.generation,
          sinceRevision: cache.selection === selected ? cache.dataset.revision : null, requestId: crypto.randomUUID(), sentByCharacter: this.sender() ?? null, observations: outgoing }), this.clock.now());
        if (epoch !== this.epoch) return;
        if (response.dataset.datasetId !== cache.dataset.datasetId || response.dataset.generation !== cache.dataset.generation) throw new Error("Sharing: the dataset changed. Sync again to refresh.");
        this.flush(); this.store.acceptSync(response, outgoing, id, selected);
        this.failures = 0; this.state.lastAt = this.clock.now(); this.state.message = "Synced.";
      } catch (error) {
        if (epoch !== this.epoch) return;
        const message = error instanceof Error && error.message.startsWith("Sharing:") ? error.message : "Sharing: sync failed. Retry or check connection settings.";
        this.state.message = pruning ? `Sharing: Removed ${removedLocal} locally; database cleanup failed. ${message}` : message; this.failures++; this.discovered = false;
        const transient = /reach Convex|temporarily unavailable|quota|rate-limiting|timed out|connection.*retry/i.test(message);
        if (!transient || this.state.resetPending) { this.state.running = false; this.state.queued = false; this.state.phase = "paused"; }
        else this.state.phase = "backoff";
      } finally {
        this.state.busy = false;
        if (epoch === this.epoch) {
          if (this.state.queued) { this.state.queued = false; this.scheduleFollowup(); }
          else if (this.state.running) {
            const delay = this.failures ? Math.min(300000, Math.max(this.state.interval * 1000, 5000 * 2 ** Math.min(this.failures, 6))) * (1 + this.jitter() * .2) : this.state.interval * 1000;
            if (!this.failures) this.state.phase = "waiting"; this.schedule(delay);
          } else if (this.state.phase !== "paused") this.state.phase = "stopped";
        } else {
          this.state.phase = "stopped";
          // A request for the new connection may arrive while the old request is draining.
          if (this.state.queued) { this.state.queued = false; this.scheduleFollowup(); }
        }
        this.publish();
      }
    })();
    await this.task;
  }
  private scheduleFollowup() { this.cancelTimer(); const epoch = this.epoch; this.timer = this.clock.set(() => { this.timer = undefined; if (epoch === this.epoch) void this.run(); }, 0); }
  async reset(expected: Dataset) {
    if (this.resetting) throw new Error("Sharing: a reset is already in progress.");
    const epoch = this.epoch;
    this.pruneRequested = false;
    this.resetting = true; this.stop(); this.state.phase = "resetting"; this.publish();
    try {
    await this.task;
    if (epoch !== this.epoch) throw new Error("Sharing: connection changed. Test and confirm the destination again.");
    let cache = this.cache();
    if (!cache || cache.dataset.datasetId !== expected.datasetId || cache.dataset.generation !== expected.generation) {
      // Reset can follow Test/Save directly, without first uploading local timers.
      const info = await this.transport.discover();
      if (epoch !== this.epoch || info.dataset?.datasetId !== expected.datasetId || info.dataset.generation !== expected.generation) throw new Error("Sharing: dataset changed. Test and confirm the destination again.");
      cache = { connectionId: connectionId(this.transport.credentials()), selection: "", dataset: info.dataset, known: {} };
    }
    const pending = cache.resetRequest ? cache : { ...cache, resetRequest: { id: crypto.randomUUID(), dataset: expected } };
    this.store.checkpoint(pending); this.state.resetPending = true; this.state.busy = true; this.state.phase = "resetting"; this.publish();
    try { await this.finishReset(pending, this.epoch); }
    catch (e) { this.state.message = "Sharing: reset outcome unknown. Sync retries the same reset safely."; throw e; }
    finally { this.state.busy = false; this.state.phase = "stopped"; this.publish(); }
    } finally { this.resetting = false; if (!this.state.busy) this.state.phase = "stopped"; this.publish(); }
  }
  private async finishReset(cache: SyncCache, epoch: number) {
    this.store.checkpoint(cache);
    const request = cache.resetRequest!;
    let dataset: Dataset;
    try { dataset = await this.transport.reset(request.dataset, request.id); }
    catch (error) {
      if (epoch !== this.epoch) return;
      // A definitive generation rejection is different from an uncertain network result.
      if (!(error instanceof Error) || !/dataset changed|dataset.*reset/i.test(error.message)) throw error;
      const info = await this.transport.discover(); if (epoch !== this.epoch) return;
      if (!info.dataset || info.dataset.datasetId === request.dataset.datasetId && info.dataset.generation <= request.dataset.generation) throw error;
      const fresh = await this.transport.sync({ protocol: SHARING_PROTOCOL, datasetId: info.dataset.datasetId, generation: info.dataset.generation, sinceRevision: null, requestId: crypto.randomUUID(), observations: [], sentByCharacter: this.sender() ?? null });
      if (epoch !== this.epoch) return; this.flush(); this.store.acceptSync(fresh, [], cache.connectionId, selectionId(this.selection()));
      this.state.resetPending = false; this.state.running = false; this.state.queued = false; this.discovered = false; this.state.message = "Another reset changed the dataset. Current shared data loaded; auto-sync is stopped."; return;
    }
    if (epoch !== this.epoch) return;
    this.flush(); this.store.acceptSync({ dataset, serverTime: this.clock.now(), full: true, slots: [], acknowledged: [] }, [], cache.connectionId, selectionId(this.selection()));
    this.state.resetPending = false; this.state.running = false; this.state.queued = false; this.discovered = false; this.state.lastAt = this.clock.now(); this.state.message = "Shared timers reset. Auto-sync is stopped.";
  }
}
