import { mkdirSync, existsSync, readFileSync, writeFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import { api } from "../../convex/_generated/api";
import { CATALOG_VERSION } from "../domain/catalog";
import { CLOCK_SKEW } from "../domain/time";
import { parseConnection, SHARING_PROTOCOL, SHARING_SCHEMA, type Connection, type ConnectionStatus, type Discovery, type SyncInput, type Dataset } from "../shared/sharing";
const errors: Record<string, string> = {
  UNAUTHORIZED: "The group key was rejected. Check it with the owner.", OWNER_SETUP: "The owner must correct or remove the invalid MVP_GROUP_KEY in this deployment.",
  NOT_INITIALIZED: "Database metadata is missing. Save connection or Sync to initialize it.", VERSION: "Install matching MVP Tracker backend functions. Reset will not fix a version mismatch.",
  GENERATION: "The dataset changed or was reset. Test the connection again before syncing.", INVALID_BATCH: "The upload contains invalid evidence. Check the system clock and timer data.",
  CONFLICTING_ID: "An observation ID has conflicting evidence.", CHARACTER_REQUIRED: "Character name needed to upload.", CAPACITY: "The dataset exceeds the supported capacity.",
};
class SharingError extends Error { constructor(message: string) { super(`Sharing: ${message}`); } }
function safeError(error: unknown): SharingError {
  if (error instanceof SharingError) return error;
  if (error instanceof ConvexError) {
    const code = (error.data as { code?: string })?.code;
    return new SharingError(errors[code ?? ""] ?? "The backend rejected the request. Check matching versions.");
  }
  // Inspect, but never expose, the SDK's server-supplied error text.
  if (error instanceof Error && /Could not find (?:public )?function|Function.*not found/i.test(error.message)) return new SharingError("Backend functions are missing. The owner must run the Convex setup guide.");
  return new SharingError("Could not reach Convex. Check your connection and deployment URL, then retry.");
}
export function validateDiscovery(value: Discovery): Discovery {
  if (!value || value.app !== "mvp-tracker" || value.protocol !== SHARING_PROTOCOL || value.schema !== SHARING_SCHEMA || value.catalog !== CATALOG_VERSION) throw new SharingError(errors.VERSION!);
  if (!Number.isSafeInteger(value.serverTime) || value.serverTime < 0) throw new SharingError("Invalid backend response.");
  const m = value.dataset;
  if (m !== null && (!m || typeof m.datasetId !== "string" || !m.datasetId || m.datasetId.length > 160 || ![m.generation, m.revision, m.resetAt].every(n => Number.isSafeInteger(n) && n >= 0) || m.generation < 1 || m.resetAt > value.serverTime)) throw new SharingError("Invalid dataset metadata.");
  return value;
}
export class SharingConnection {
  readonly file: string;
  private config: Connection = { url: "", groupKey: "" };
  private generation = 0;
  private active = new Set<AbortController>();
  private status: ConnectionStatus = { configured: false, url: "", hasKey: false, state: "empty", message: "Sharing is not configured." };
  constructor(root: string, private changed: () => void = () => {}, private fetcher: typeof fetch = globalThis.fetch) {
    this.file = join(root, "data", "sharing-secrets.json");
    if (!existsSync(this.file)) return;
    try {
      if (statSync(this.file).size > 4096) throw new Error();
      const raw = JSON.parse(readFileSync(this.file, "utf8")); if (raw.schemaVersion !== 1) throw new Error();
      this.config = parseConnection(raw); this.resetStatus();
    } catch { this.status = { ...this.status, state: "error", message: "Sharing settings could not be read. The file is preserved until you save a connection." }; }
  }
  snapshot(): ConnectionStatus { return structuredClone(this.status); }
  credentials(): Connection { return { ...this.config }; }
  async discover(initialize = false): Promise<Discovery> {
    const generation = this.generation;
    const info = validateDiscovery(await this.request((c, key) => c.query(api.timers.testConnection, { key, protocol: SHARING_PROTOCOL })));
    if (generation !== this.generation) throw new SharingError("Connection changed. Retry with the saved connection.");
    if (Math.abs(info.serverTime - Date.now()) > CLOCK_SKEW) throw new SharingError("The Windows clock differs from the server by more than 30 seconds. Correct it before syncing.");
    if (initialize && !info.dataset) info.dataset = await this.request((c, key) => c.mutation(api.timers.ensureInitialized, { key, protocol: SHARING_PROTOCOL }));
    if (generation !== this.generation) throw new SharingError("Connection changed. Retry with the saved connection.");
    return info;
  }
  async prepare(): Promise<ConnectionStatus> {
    const generation = this.generation;
    this.status = { ...this.status, state: "testing", message: "Checking database setup…", dataset: undefined }; this.changed();
    try {
      const info = await this.discover(true); if (generation !== this.generation) return this.snapshot();
      this.status = { ...this.status, state: "ready", message: "Database ready.", dataset: info.dataset!, testedAt: Date.now() };
    } catch (e) { if (generation === this.generation) this.status = { ...this.status, state: "error", message: safeError(e).message, dataset: undefined }; }
    if (generation === this.generation) this.changed(); return this.snapshot();
  }
  configure(raw: Connection): ConnectionStatus {
    const next = parseConnection(raw), temporary = `${this.file}.tmp`;
    if (next.url === this.config.url && next.groupKey === this.config.groupKey && this.status.state !== "error") return this.snapshot();
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(temporary, JSON.stringify({ schemaVersion: 1, ...next }) + "\n", { encoding: "utf8", flush: true }); renameSync(temporary, this.file);
    } catch { try { unlinkSync(temporary); } catch {} throw new SharingError("Could not save the connection. Check portable folder write access and free space."); }
    this.close(); this.config = next; this.resetStatus(); this.changed(); return this.snapshot();
  }
  private resetStatus() { this.status = { configured: !!this.config.url, url: this.config.url, hasKey: !!this.config.groupKey, state: this.config.url ? "untested" : "empty", message: this.config.url ? "Connection saved. Test it before syncing." : "Sharing is not configured." }; }
  close() { this.generation++; for (const controller of this.active) controller.abort(); this.active.clear(); }
  private async request<T>(work: (client: ConvexHttpClient, key: string) => Promise<T>): Promise<T> {
    if (!this.config.url) throw new SharingError("Add a deployment URL first.");
    const config = { ...this.config }, generation = this.generation, controller = new AbortController(); this.active.add(controller);
    const timeout = setTimeout(() => controller.abort(), 8000);
    const guardedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const target = new URL(input instanceof Request ? input.url : String(input));
      if (target.origin !== config.url || !["/api/query", "/api/mutation"].includes(target.pathname)) throw new SharingError("Unexpected connection destination.");
      const response = await this.fetcher(input, { ...init, redirect: "error", signal: controller.signal });
      if (response.status === 429) throw new SharingError("Convex is rate-limiting requests. Wait before retrying and check your usage.");
      if (response.status >= 500 && response.status !== 560) throw new SharingError("Convex is temporarily unavailable or its quota is exhausted. Retry later and check the dashboard.");
      return response;
    }) as typeof fetch;
    try {
      const client = new ConvexHttpClient(config.url, { logger: false, fetch: guardedFetch });
      const result = await work(client, config.groupKey);
      if (this.generation !== generation || controller.signal.aborted) throw new SharingError("Connection changed or the request timed out. Its response was discarded.");
      return result;
    } catch (e) { throw safeError(e); } finally { clearTimeout(timeout); this.active.delete(controller); }
  }
  async test(): Promise<ConnectionStatus> {
    const generation = this.generation;
    if (this.status.state === "testing") return this.snapshot();
    this.status = { ...this.status, state: "testing", message: "Testing connection…", dataset: undefined }; this.changed();
    try {
      const discovery = validateDiscovery(await this.request((c, key) => c.query(api.timers.testConnection, { key, protocol: SHARING_PROTOCOL })));
      if (generation !== this.generation) return this.snapshot();
      if (!discovery.dataset) throw new SharingError(errors.NOT_INITIALIZED!);
      if (Math.abs(discovery.serverTime - Date.now()) > CLOCK_SKEW) throw new SharingError("The Windows clock differs from the server by more than 30 seconds. Correct it before syncing.");
      this.status = { ...this.status, state: "ready", message: "Connection ready.", dataset: discovery.dataset, testedAt: Date.now() };
    } catch (e) {
      if (generation === this.generation) this.status = { ...this.status, state: "error", message: safeError(e).message, dataset: undefined };
    }
    if (generation === this.generation) this.changed();
    return this.snapshot();
  }
  pull(expected: Dataset) { return this.request((c, key) => c.query(api.timers.snapshot, { key, protocol: SHARING_PROTOCOL, datasetId: expected.datasetId, generation: expected.generation })); }
  sync(input: SyncInput) { return this.request((c, key) => c.mutation(api.timers.sync, { ...input, key })); }
  reset(expected: Dataset, requestId: string) { return this.request((c, key) => c.mutation(api.timers.reset, { key, protocol: SHARING_PROTOCOL, datasetId: expected.datasetId, generation: expected.generation, requestId })); }
}
