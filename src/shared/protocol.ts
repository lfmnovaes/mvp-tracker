import { defaultSelection, parseSelection, type Selection } from "../domain/catalog";
import { defaultSort, parseSort, type Sort } from "../domain/query";
import type { TimerSlot } from "../domain/timers";
export const VERSION = "0.1.2";
export const EXTENSION = "dev.lfmnovaes.backend";
export const REQUEST = "mvp:request";
export const RESPONSE = "mvp:response";
export const UPDATE = "mvp:update";
export const ACTIONS = ["toggle", "add", "sync"] as const;
export type Action = typeof ACTIONS[number];
export interface Settings {
  schemaVersion: 2;
  startMinimized: boolean;
  clock24: boolean;
  hotkeys: Record<Action, string>;
  tracking: Selection;
  sort: Sort;
}
export const defaults = (): Settings => ({ schemaVersion: 2, startMinimized: false, clock24: false,
  hotkeys: { toggle: "F7", add: "F8", sync: "F9" }, tracking: defaultSelection(), sort: defaultSort() });

// Restrict v1 bindings to a deliberate, predictable set; empty means disabled.
export function validShortcut(value: unknown): value is string {
  return typeof value === "string" && (value === "" || /^(?:(?:Ctrl\+)?(?:Alt\+)?(?:Shift\+)?)(?:F(?:[1-9]|1[0-9]|2[0-4])|[A-Z0-9])$/.test(value)
    && !/^[A-Z0-9]$/.test(value) && value !== "F12");
}
export function parseSettings(value: unknown): Settings {
  if (!value || typeof value !== "object") throw new Error("Invalid settings.");
  const s = value as Omit<Settings, "schemaVersion"> & { schemaVersion: number };
  if (![1, 2].includes(s.schemaVersion) || typeof s.startMinimized !== "boolean" || typeof s.clock24 !== "boolean" || !s.hotkeys) throw new Error("Invalid settings.");
  if (!ACTIONS.every(a => validShortcut(s.hotkeys[a]))) throw new Error("Use F1–F24 (except reserved F12), or Ctrl/Alt/Shift plus a letter or digit.");
  const enabled = ACTIONS.map(a => s.hotkeys[a]).filter(Boolean);
  if (new Set(enabled).size !== enabled.length) throw new Error("Each enabled shortcut must be unique.");
  return { schemaVersion: 2, startMinimized: s.startMinimized, clock24: s.clock24,
    hotkeys: { toggle: s.hotkeys.toggle, add: s.hotkeys.add, sync: s.hotkeys.sync },
    tracking: s.schemaVersion === 1 ? defaultSelection() : parseSelection(s.tracking),
    sort: s.schemaVersion === 1 ? defaultSort() : parseSort(s.sort) };
}
export interface Snapshot {
  version: string;
  settings: Settings;
  storageWritable: boolean;
  warning: string | null;
  trayReady: boolean;
  hotkeyErrors: Partial<Record<Action, string>>;
  timers: TimerSlot[];
}
export interface Operations {
  hotkeyCapture: { input: boolean; output: null };
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
export function parseRequest(raw: unknown): Request {
  if (!raw || typeof raw !== "object") throw new Error("Invalid request.");
  const r = raw as Request;
  if (typeof r.id !== "string" || !/^[a-z0-9-]{1,80}$/i.test(r.id)) throw new Error("Invalid request ID.");
  switch (r.method) {
    case "hotkeyCapture": if (typeof r.input !== "boolean") throw new Error("Invalid capture request."); break;
    case "snapshot": case "clipboardRead": if (r.input !== null) throw new Error("Invalid request."); break;
    case "saveSettings": return { ...r, input: parseSettings(r.input) };
    case "shell": if (!["show", "hide", "minimize", "exit", "add", "sync"].includes(r.input)) throw new Error("Invalid action."); break;
    case "clipboardWrite": if (typeof r.input !== "string" || r.input.length > 1_000_000) throw new Error("Clipboard input is too large."); break;
    default: throw new Error("Unknown method.");
  }
  return r;
}
