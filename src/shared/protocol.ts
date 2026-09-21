import { defaultSelection, parseSelection, type Selection } from "../domain/catalog";
import { defaultSort, parseSort, type Sort } from "../domain/query";
import { parseSlot, type TimerSlot, type Slot } from "../domain/timers";
import { parseManualRequest, type ManualRequest } from "../domain/manual";
import { EXCHANGE_LIMIT, type ExportFormat, type ImportSummary } from "./exchange";
import { captureDefaults, parseCaptureSettings, type CaptureSettings, type CaptureSnapshot } from "./capture";
import { parseConnection, type Connection, type ConnectionStatus } from "./sharing";
import type { SyncStatus } from "../backend/sync-coordinator";
import { parseDataset } from "../domain/sync";
import type { Dataset } from "./sharing";
import { COLOR_INTERVALS, DEFAULT_COLOR_INTERVAL } from "./colors";
import { SYNC_INTERVALS } from "./sync-intervals";
export const VERSION = "0.1.9.3";
export const EXTENSION = "dev.lfmnovaes.backend";
export const REQUEST = "mvp:request";
export const RESPONSE = "mvp:response";
export const UPDATE = "mvp:update";
export const ACTIONS = ["toggle", "add", "sync"] as const;
export type Action = typeof ACTIONS[number];
export interface Settings {
  schemaVersion: 8;
  syncInterval: number;
  colorInterval: number;
  uiScale: number;
  startMinimized: boolean;
  clock24: boolean;
  hotkeys: Record<Action, string>;
  tracking: Selection;
  sort: Sort;
  capture: CaptureSettings;
}
export const defaults = (): Settings => ({ schemaVersion: 8, syncInterval: 60, colorInterval: DEFAULT_COLOR_INTERVAL, uiScale: 100, startMinimized: false, clock24: true,
  hotkeys: { toggle: "F7", add: "F8", sync: "F9" }, tracking: defaultSelection(), sort: defaultSort(), capture: captureDefaults() });

// Restrict v1 bindings to a deliberate, predictable set; empty means disabled.
export function validShortcut(value: unknown): value is string {
  return typeof value === "string" && (value === "" || /^(?:(?:Ctrl\+)?(?:Alt\+)?(?:Shift\+)?)(?:F(?:[1-9]|1[0-9]|2[0-4])|[A-Z0-9])$/.test(value)
    && !/^[A-Z0-9]$/.test(value) && value !== "F12");
}
export function parseSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") throw new Error("Invalid settings.");
  const s = value as Omit<Settings, "schemaVersion"> & { schemaVersion: number };
  if (![1, 2, 3, 4, 5, 6, 7, 8].includes(s.schemaVersion) || typeof s.startMinimized !== "boolean" || typeof s.clock24 !== "boolean" || !s.hotkeys) throw new Error("Invalid settings.");
  if (s.schemaVersion === 6 && ![10, 20, 30, 60, 120, 300].includes(s.syncInterval) || s.schemaVersion >= 7 && !SYNC_INTERVALS.includes(s.syncInterval as typeof SYNC_INTERVALS[number])) throw new Error("Invalid sync interval.");
  if (s.schemaVersion >= 8 && !COLOR_INTERVALS.includes(s.colorInterval as typeof COLOR_INTERVALS[number])) throw new Error("Invalid color interval.");
  if (s.schemaVersion >= 4 && ![80, 90, 100, 110, 125].includes(s.uiScale)) throw new Error("Invalid UI scale.");
  if (!ACTIONS.every(a => validShortcut(s.hotkeys[a]))) throw new Error("Use F1–F24 (except reserved F12), or Ctrl/Alt/Shift plus a letter or digit.");
  const enabled = ACTIONS.map(a => s.hotkeys[a]).filter(Boolean);
  if (new Set(enabled).size !== enabled.length) throw new Error("Each enabled shortcut must be unique.");
  return { schemaVersion: 8, colorInterval: s.schemaVersion < 8 ? DEFAULT_COLOR_INTERVAL : s.colorInterval, syncInterval: s.schemaVersion < 6 ? 60 : s.syncInterval === 300 ? 120 : s.syncInterval, uiScale: s.schemaVersion < 4 ? 100 : s.uiScale, startMinimized: s.startMinimized, clock24: s.schemaVersion < 5 ? true : s.clock24,
    hotkeys: { toggle: s.hotkeys.toggle, add: s.hotkeys.add, sync: s.hotkeys.sync },
    tracking: s.schemaVersion === 1 ? defaultSelection() : parseSelection(s.tracking),
    sort: s.schemaVersion === 1 ? defaultSort() : parseSort(s.sort),
    capture: s.schemaVersion < 3 ? captureDefaults() : parseCaptureSettings(s.capture) };
}
export interface Snapshot {
  version: string;
  settings: Settings;
  storageWritable: boolean;
  warning: string | null;
  trayReady: boolean;
  hotkeyErrors: Partial<Record<Action, string>>;
  timers: TimerSlot[];
  capture: CaptureSnapshot;
  diagnosticsUntil: number;
  sharing?: ConnectionStatus;
  sync?: SyncStatus;
}
export interface Operations {
  pruneOutdated: { input: null; output: SyncStatus };
  syncControl: { input: "now" | "start" | "stop"; output: SyncStatus };
  syncInterval: { input: number; output: Snapshot };
  sharingReset: { input: Dataset; output: SyncStatus };
  sharingRead: { input: null; output: Connection };
  sharingSave: { input: Connection; output: ConnectionStatus };
  sharingTest: { input: null; output: ConnectionStatus };
  removeTimer: { input: Slot; output: Snapshot };
  exportTimers: { input: ExportFormat; output: number };
  importTimers: { input: { text: string; commit: boolean }; output: { summary: ImportSummary; snapshot?: Snapshot } };
  hotkeyCapture: { input: boolean; output: null };
  captureRestart: { input: null; output: null };
  saveManual: { input: ManualRequest; output: Snapshot };
  diagnostics: { input: "open" | "clear" | "copy" | "start" | "stop"; output: string };
  snapshot: { input: null; output: Snapshot };
  saveSettings: { input: Settings; output: Snapshot };
  shell: { input: "show" | "hide" | "minimize" | "exit" | "add" | "sync"; output: null };
  clipboardRead: { input: null; output: string };
  clipboardWrite: { input: string; output: null };
}
export type Method = keyof Operations;
export type Request = { [K in Method]: { id: string; method: K; input: Operations[K]["input"] } }[Method];
export type Response = { id: string; result?: unknown; error?: string };
export type Update = { type: "snapshot"; value: Snapshot } | { type: "settings" | "add" | "sync" | "show" };
export function requestId(raw: unknown): string | undefined {
  const id = (raw as { id?: unknown } | null)?.id;
  return typeof id === "string" && /^[a-z0-9-]{1,80}$/i.test(id) ? id : undefined;
}
export function parseRequest(raw: unknown): Request {
  if (!raw || typeof raw !== "object") throw new Error("Invalid request.");
  const r = raw as Request;
  if (typeof r.id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(r.id)) throw new Error("Invalid request ID.");
  switch (r.method) {
    case "syncControl": if (!["now", "start", "stop"].includes(r.input)) throw new Error("Invalid sync action."); break;
    case "syncInterval": if (!SYNC_INTERVALS.includes(r.input as typeof SYNC_INTERVALS[number])) throw new Error("Invalid sync interval."); break;
    case "sharingReset": return { ...r, input: parseDataset(r.input) };
    case "sharingRead": case "sharingTest": case "pruneOutdated": if (r.input !== null) throw new Error("Invalid sharing request."); break;
    case "sharingSave": return { ...r, input: parseConnection(r.input) };
    case "removeTimer": return { ...r, input: parseSlot(r.input) };
    case "exportTimers": if (!["text", "json", "compressed"].includes(r.input)) throw new Error("Invalid export format."); break;
    case "importTimers": if (!r.input || typeof r.input.text !== "string" || r.input.text.length > EXCHANGE_LIMIT || typeof r.input.commit !== "boolean") throw new Error("Invalid import request or size."); break;
    case "hotkeyCapture": if (typeof r.input !== "boolean") throw new Error("Invalid capture request."); break;
    case "snapshot": case "clipboardRead": case "captureRestart": if (r.input !== null) throw new Error("Invalid request."); break;
    case "saveSettings": return { ...r, input: parseSettings(r.input) };
    case "saveManual": return { ...r, input: parseManualRequest(r.input) };
    case "diagnostics": if (!["open", "clear", "copy", "start", "stop"].includes(r.input)) throw new Error("Invalid diagnostics action."); break;
    case "shell": if (!["show", "hide", "minimize", "exit", "add", "sync"].includes(r.input)) throw new Error("Invalid action."); break;
    case "clipboardWrite": if (typeof r.input !== "string" || r.input.length > 1_000_000) throw new Error("Clipboard input is too large."); break;
    default: throw new Error("Unknown method.");
  }
  return r;
}
