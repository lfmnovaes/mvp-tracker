import { BOSSES, type Selection } from "./catalog";
import { parseSlot, slotKey, type ManualEntry, type Slot, type TimerSlot } from "./timers";
import { dateInZone, zonedParts } from "./time";

export interface ManualRequest { mode: "add" | "edit"; entry: ManualEntry; originalSlot?: Slot }
export function parseManualRequest(raw: unknown): ManualRequest {
  const value = raw as ManualRequest;
  if (!value || !["add", "edit"].includes(value.mode) || !value.entry) throw new Error("Invalid manual entry.");
  const e = value.entry, slot = parseSlot(e);
  if (typeof e.date !== "string" || e.date.length !== 10 || typeof e.time !== "string" || e.time.length > 8 || typeof e.clock24 !== "boolean"
    || e.meridiem !== undefined && !["AM", "PM"].includes(e.meridiem)
    || e.killedBy !== undefined && (typeof e.killedBy !== "string" || e.killedBy.length > 80 || /[\u0000-\u001f\u007f]/.test(e.killedBy))) throw new Error("Invalid kill date, time or killer.");
  const originalSlot = value.mode === "edit" ? parseSlot(value.originalSlot) : undefined;
  if (originalSlot && slotKey(originalSlot) !== slotKey(slot)) throw new Error("Invalid edit: boss, region and channel must stay fixed.");
  // Discard caller-supplied evidence/source/observer fields; the backend owns them.
  return { mode: value.mode, originalSlot, entry: { ...slot, date: e.date, time: e.time, clock24: e.clock24,
    meridiem: e.meridiem, killedBy: e.killedBy?.trim() || undefined } };
}
export function manualBosses(selection: Selection) {
  return BOSSES.filter(b => selection.bossIds.includes(b.id)).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "en"));
}
export function manualDraft(selection: Selection, clock24: boolean, now: number, edit?: TimerSlot): ManualEntry | undefined {
  const boss = manualBosses(selection)[0], region = selection.regions[0];
  if (!edit && (!boss || !region)) return;
  const at = edit?.observation?.diedAt ?? now, p = zonedParts(at);
  const hour = clock24 ? p.hour : p.hour % 12 || 12;
  return { mobId: edit?.mobId ?? boss!.id, region: edit?.region ?? region!, channel: edit?.channel ?? 1,
    date: dateInZone(at), time: `${String(hour).padStart(2, "0")}:${String(p.minute).padStart(2, "0")}${edit?.observation ? `:${String(p.second).padStart(2, "0")}` : ""}`,
    clock24, meridiem: p.hour >= 12 ? "PM" : "AM", killedBy: edit?.observation?.killedBy ?? "" };
}
