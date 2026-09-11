import type { Observation, TimerSlot } from "../domain/timers";
export const SHARING_PROTOCOL = 1;
export const SHARING_SCHEMA = 1;
export interface Connection { url: string; groupKey: string }
export interface Dataset { datasetId: string; generation: number; revision: number; resetAt: number }
export interface Discovery { app: "mvp-tracker"; protocol: number; schema: number; catalog: number; serverTime: number; dataset: Dataset | null; disposable?: boolean }
export interface SharedSlot extends TimerSlot { revision: number }
export interface SyncResult { dataset: Dataset; serverTime: number; full: boolean; slots: SharedSlot[]; acknowledged: string[] }
export interface SyncInput { protocol: number; datasetId: string; generation: number; sinceRevision: number | null; requestId: string; sentByCharacter?: string; observations: Observation[] }
export interface ConnectionStatus { configured: boolean; url: string; hasKey: boolean; state: "empty" | "untested" | "testing" | "ready" | "error"; message: string; dataset?: Dataset; testedAt?: number }
export function parseConnection(raw: unknown): Connection {
  if (!raw || typeof raw !== "object") throw new Error("Sharing: invalid connection.");
  const c = raw as Connection;
  if (typeof c.url !== "string" || typeof c.groupKey !== "string") throw new Error("Sharing: invalid connection.");
  const url = c.url.trim(), groupKey = c.groupKey.trim();
  if (!url && !groupKey) return { url: "", groupKey: "" };
  // Only the documented cloud client origin; no paths, credentials, ports or redirect targets.
  if (!/^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.convex\.cloud\/?$/.test(url)) throw new Error("Sharing: use an HTTPS deployment URL ending in .convex.cloud, without a path.");
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(groupKey)) throw new Error("Sharing: the group key must contain 32–128 letters, digits, underscores or hyphens.");
  return { url: url.replace(/\/$/, ""), groupKey };
}
