export const TIME_ZONE = "America/Sao_Paulo";
export const MINUTE = 60_000;
export const ELIGIBLE_AFTER = 60 * MINUTE;
export const SPAWN_AFTER = 90 * MINUTE;
export const EXPIRE_AFTER = 150 * MINUTE;
export const CLOCK_SKEW = 30_000;
const partsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
export function zonedParts(at: number): Record<string, number> {
  return Object.fromEntries(partsFormatter.formatToParts(at).filter(p => p.type !== "literal").map(p => [p.type, Number(p.value)]));
}
export function dateInZone(at: number): string {
  const p = zonedParts(at); return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}
export function formatClock(at: number, clock24 = true, seconds = false): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: clock24 ? "2-digit" : "numeric", minute: "2-digit",
    ...(seconds ? { second: "2-digit" as const } : {}), hourCycle: clock24 ? "h23" : "h12" }).format(at);
}
export function formatTimestamp(at: number, clock24 = true): string { return `${dateInZone(at)} ${formatClock(at, clock24, true)}`; }
export interface ManualTime { date: string; time: string; clock24: boolean; meridiem?: "AM" | "PM" }
export function parseManualTime(input: ManualTime, now: number): { diedAt: number; timePrecision: "minute" | "second" } {
  if (typeof input?.date !== "string" || typeof input.time !== "string" || typeof input.clock24 !== "boolean") throw new Error("Invalid kill date or time.");
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.date);
  const time = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(input.time);
  if (!date || !time) throw new Error("Invalid kill date or time.");
  const [year, month, day] = date.slice(1).map(Number);
  let hour = Number(time[1]); const minute = Number(time[2]), second = Number(time[3] ?? 0);
  if (year < 2000 || year > 9999 || month < 1 || month > 12 || day < 1 || day > 31 || minute > 59 || second > 59) throw new Error("Invalid kill date or time.");
  if (input.clock24) { if (hour > 23) throw new Error("Invalid 24-hour time."); }
  else {
    if (hour < 1 || hour > 12 || !["AM", "PM"].includes(input.meridiem ?? "")) throw new Error("Invalid AM/PM time.");
    hour = hour % 12 + (input.meridiem === "PM" ? 12 : 0);
  }
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  const calendar = new Date(wall);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) throw new Error("Invalid calendar date.");
  // Start at UTC-3, then resolve against the zone's own rules instead of the Windows zone.
  let diedAt = wall + 3 * 60 * MINUTE;
  const p = zonedParts(diedAt);
  diedAt += wall - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const check = zonedParts(diedAt);
  if ([check.year, check.month, check.day, check.hour, check.minute, check.second].join() !== [year, month, day, hour, minute, second].join()) throw new Error("Invalid time in America/Sao_Paulo.");
  if (!Number.isSafeInteger(now) || diedAt > now) throw new Error("Kill time cannot be in the future.");
  return { diedAt, timePrecision: time[3] === undefined ? "minute" : "second" };
}
