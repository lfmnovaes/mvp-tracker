import { existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isSelected, parseSelection, type Selection } from "../domain/catalog";
import { applyManual, expireSlots, mergeObservations, parseSlot, parseTimerState, slotKey, TIMER_SCHEMA, type ManualEntry, type TimerSlot, type Slot } from "../domain/timers";
const MAX_FILE_BYTES = 2 * 1024 * 1024;

// In-memory transitions are synchronous and file replacement is atomic. No stale async save can overtake a new observation.
export class TimerStore {
  private slots: TimerSlot[] = [];
  readonly file: string;
  warning: string | null = null;
  private writeBlocked = false;
  private dirty = false;
  constructor(root: string, private selection: Selection, private now: () => number = Date.now) {
    this.selection = parseSelection(selection);
    this.file = join(root, "data", "timers.json");
    this.load();
  }
  private load() {
    const temporary = `${this.file}.tmp`;
    // A committed file wins. An orphaned atomic-save temporary is recovered only when no committed file exists.
    const source = existsSync(this.file) ? this.file : existsSync(temporary) ? temporary : undefined;
    if (!source) return;
    try {
      if (statSync(source).size > MAX_FILE_BYTES) throw new Error("File too large.");
      const saved = JSON.parse(readFileSync(source, "utf8"));
      this.slots = parseTimerState(saved, this.now());
      this.dirty = source === temporary || JSON.stringify(saved) !== JSON.stringify(this.serialized());
      if (this.dirty) this.flush();
      // A leftover temporary never overrides committed data and must not keep expired payloads as a hidden history.
      if (source === this.file && existsSync(temporary) && !this.dirty) unlinkSync(temporary);
    } catch {
      // Never destroy an unknown schema or a corrupt original by automatically saving an empty state over it.
      this.writeBlocked = true;
      this.warning = "Timer data could not be read. The original file is preserved; correct or move it before restarting. New observations can be held in memory only.";
    }
  }
  private serialized() { return { schemaVersion: TIMER_SCHEMA, slots: this.slots }; }
  private replace(slots: TimerSlot[]): boolean {
    if (JSON.stringify(slots) === JSON.stringify(this.slots)) return false;
    this.slots = slots; this.dirty = true; this.flush(); return true;
  }
  setSelection(selection: Selection) { this.selection = parseSelection(selection); this.expire(); }
  snapshot(): TimerSlot[] { this.expire(); return structuredClone(this.slots); }
  selectedSnapshot(): TimerSlot[] { return this.snapshot().filter(slot => isSelected(slot, this.selection)); }
  ingest(observations: readonly unknown[]): boolean { return this.replace(mergeObservations(this.slots, observations, this.now(), this.selection)); }
  saveManual(entry: ManualEntry): boolean { return this.replace(applyManual(this.slots, entry, this.now(), this.selection)); }
  remove(slot: Slot): boolean {
    const key = slotKey(parseSlot(slot));
    return this.replace(this.slots.filter(s => slotKey(s) !== key));
  }
  expire(): boolean { return this.replace(expireSlots(this.slots, this.now())); }
  flush(): void {
    if (!this.dirty || this.writeBlocked) return;
    const temporary = `${this.file}.tmp`;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(temporary, JSON.stringify(this.serialized()) + "\n", { encoding: "utf8", flush: true });
      renameSync(temporary, this.file);
      this.dirty = false; this.warning = null;
    } catch {
      this.warning = "Timer data could not be saved. Changes are held in memory; check portable folder write access and free space.";
    }
  }
  close() { this.expire(); this.flush(); }
}
