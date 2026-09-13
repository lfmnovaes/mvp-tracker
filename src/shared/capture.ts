import type { Region } from "../domain/catalog";
export interface CaptureSettings { deviceName: string; manualCharacter: string; coordinates?: boolean }
export const captureDefaults = (): CaptureSettings => ({ deviceName: "", manualCharacter: "", coordinates: true });
export function parseCaptureSettings(value: unknown): CaptureSettings {
  const s = value as CaptureSettings | null;
  if (!s || typeof s.deviceName !== "string" || s.deviceName.length > 512 || /[\u0000-\u001f]/.test(s.deviceName)
    || typeof s.manualCharacter !== "string" || s.manualCharacter.length > 80 || /[\u0000-\u001f\u007f]/.test(s.manualCharacter)) throw new Error("Invalid capture settings.");
  if (s.coordinates !== undefined && typeof s.coordinates !== "boolean") throw new Error("Invalid experimental capture settings.");
  return { deviceName: s.deviceName, manualCharacter: s.manualCharacter.trim(), coordinates: s.coordinates ?? true };
}
export interface CaptureSnapshot {
  state: "starting" | "running" | "unavailable" | "stopped";
  game: "unknown" | "waiting" | "active";
  detail: string;
  adapter?: string;
  devices: { name: string; label: string }[];
  lastPacketAt?: number;
  retryAt?: number;
  region?: Region;
  channel?: 1 | 2 | 3;
  character?: string;
  cachedCharacter?: string;
  identity: { name?: string; source: "live" | "cached" | "manual" | "unavailable" };
  skipped: number;
  unresolved: number;
  experiments?: { positions: number };
}
export const emptyCapture = (): CaptureSnapshot => ({ state: "stopped", game: "unknown", detail: "Capture is starting.", devices: [], identity: { source: "unavailable" }, skipped: 0, unresolved: 0 });
