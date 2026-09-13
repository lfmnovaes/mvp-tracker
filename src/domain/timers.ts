import { bossById, isSelected, normalizeRegion, type BossId, type Channel, type Region, type Selection } from "./catalog";
import { CLOCK_SKEW, ELIGIBLE_AFTER, EXPIRE_AFTER, SPAWN_AFTER, parseManualTime, type ManualTime } from "./time";
export const TIMER_SCHEMA = 2;
export const ALIVE_FRESH_FOR = 60_000;
export const ALIVE_EXPIRE_AFTER = 5 * 60_000;
export interface WorldPosition { x: number; y: number; z: number }
export const MAX_SLOTS = 33 * 6 * 3;
export const MAX_BATCH = MAX_SLOTS * 4;
export interface Slot { mobId: BossId; region: Region; channel: Channel }
export interface Observation extends Slot {
  observationId: string;
  diedAt?: number;
  gatheredAt: number;
  source: "manual" | "gravestone" | "alive";
  timePrecision: "minute" | "second" | "millisecond";
  killedBy?: string;
  observedByCharacter?: string;
  instanceId?: string;
  replacesObservationId?: string;
  position?: WorldPosition;
  submission?: { submittedByCharacter: string | null; serverAcceptedAt: number };
}
export interface TimerSlot extends Slot { observation?: Observation; outdated: boolean }
export type TimerStatus = "alive" | "seenAlive" | "waiting" | "window" | "spawned" | "outdated" | "empty";
export function observationStart(o: Pick<Observation, "source" | "gatheredAt" | "diedAt">): number { return o.source === "alive" ? o.gatheredAt : o.diedAt!; }
export function observationExpiresAt(o: Pick<Observation, "source" | "gatheredAt" | "diedAt">): number { return observationStart(o) + (o.source === "alive" ? ALIVE_EXPIRE_AFTER : EXPIRE_AFTER); }
export function parsePosition(raw: unknown): WorldPosition {
  const p = raw as WorldPosition;
  if (!p || ![p.x, p.y, p.z].every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 100_000)) throw new Error("Invalid world position.");
  return { x: p.x, y: p.y, z: p.z };
}
export function slotKey(slot: Slot): string { return `${encodeURIComponent(slot.mobId)}|${slot.region}|${slot.channel}`; }
export function parseSlot(raw: unknown): Slot {
  if (!raw || typeof raw !== "object") throw new Error("Invalid timer slot.");
  const s = raw as Slot;
  const boss = bossById(s.mobId), region = normalizeRegion(s.region);
  if (!boss || !region || ![1, 2, 3].includes(s.channel) || !Number.isInteger(s.channel)) throw new Error("Invalid boss, region or channel.");
  return { mobId: boss.id, region, channel: s.channel };
}
function boundedText(value: unknown, limit: number): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length > limit || /[\u0000-\u001f\u007f]/.test(value)) throw new Error("Invalid observation text.");
  return value.trim() || undefined;
}
function observationId(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(value)) throw new Error("Invalid observation ID.");
  return value;
}
export function parseObservation(raw: unknown, now: number): Observation {
  const slot = parseSlot(raw); const o = raw as Observation;
  if (![o.gatheredAt, now].every(t => Number.isSafeInteger(t) && t >= 0) || o.gatheredAt > now + CLOCK_SKEW) throw new Error("Invalid or future observation timestamp. Check the system clock.");
  if (!["manual", "gravestone", "alive"].includes(o.source) || !["minute", "second", "millisecond"].includes(o.timePrecision)) throw new Error("Invalid observation source or precision.");
  if (o.source === "alive") {
    if (o.diedAt !== undefined || o.killedBy !== undefined || o.timePrecision !== "millisecond") throw new Error("Invalid live observation: a sighting has no kill time or killer.");
  } else {
    if (!Number.isSafeInteger(o.diedAt) || o.diedAt! < 0 || o.diedAt! > now + CLOCK_SKEW || o.diedAt! > o.gatheredAt + CLOCK_SKEW) throw new Error("Invalid or future observation timestamp. Check the system clock.");
    if (o.source === "gravestone" && o.gatheredAt >= o.diedAt! + SPAWN_AFTER + CLOCK_SKEW) throw new Error("Invalid gravestone timing: the observation contradicts the 90-minute respawn rule.");
  }
  const fields = { killedBy: boundedText(o.killedBy, 80), observedByCharacter: boundedText(o.observedByCharacter, 80), instanceId: boundedText(o.instanceId, 160),
    replacesObservationId: o.replacesObservationId === undefined ? undefined : observationId(o.replacesObservationId) };
  let submission: Observation["submission"];
  if (o.submission !== undefined) {
    const name = o.submission?.submittedByCharacter === null ? null : boundedText(o.submission?.submittedByCharacter, 80), at = o.submission?.serverAcceptedAt;
    if (name === undefined || !Number.isSafeInteger(at) || at < 0 || at > now + CLOCK_SKEW) throw new Error("Invalid submission metadata.");
    submission = { submittedByCharacter: name, serverAcceptedAt: at };
  }
  return { ...slot, observationId: observationId(o.observationId), ...(o.source === "alive" ? {} : { diedAt: o.diedAt }), gatheredAt: o.gatheredAt, source: o.source, timePrecision: o.timePrecision,
    ...(o.position === undefined ? {} : { position: parsePosition(o.position) }),
    ...Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined)), ...(submission ? { submission } : {}) };
}
// Transport attribution is not part of an observation's evidence identity.
export function evidenceContent(o: Observation): string {
  return JSON.stringify([o.mobId, o.region, o.channel, o.observationId, o.diedAt, o.gatheredAt, o.source, o.timePrecision,
    o.killedBy, o.observedByCharacter, o.instanceId, o.replacesObservationId, o.position]);
}
export function timerStatus(slot: TimerSlot, now: number): TimerStatus {
  if (!slot.observation) return slot.outdated ? "outdated" : "empty";
  if (slot.observation.source === "alive") {
    const age = now - slot.observation.gatheredAt;
    return age >= ALIVE_EXPIRE_AFTER ? "outdated" : age >= ALIVE_FRESH_FOR ? "seenAlive" : "alive";
  }
  const age = now - slot.observation.diedAt!;
  return age >= EXPIRE_AFTER ? "outdated" : age >= SPAWN_AFTER ? "spawned" : age >= ELIGIBLE_AFTER ? "window" : "waiting";
}
export function emptySlot(slot: Slot, outdated = false): TimerSlot { return { mobId: slot.mobId, region: slot.region, channel: slot.channel, outdated }; }
export function expireSlots(slots: readonly TimerSlot[], now: number): TimerSlot[] {
  return slots.map(s => s.observation && now >= observationExpiresAt(s.observation) ? emptySlot(s, true) : s);
}
export function compareEvidence(a: Observation, b: Observation): number {
  return a.gatheredAt - b.gatheredAt || (a.observationId < b.observationId ? -1 : a.observationId > b.observationId ? 1 : 0);
}
function ordered(slots: Iterable<TimerSlot>): TimerSlot[] { return Array.from(slots).sort((a, b) => slotKey(a).localeCompare(slotKey(b), "en")); }
// Validates the whole batch before mutation. Receipt time and source never decide freshness.
export function mergeObservations(current: readonly TimerSlot[], raw: readonly unknown[], now: number, selection?: Selection): TimerSlot[] {
  if (!Array.isArray(raw) || raw.length > MAX_BATCH) throw new Error("Invalid observation batch size.");
  const incoming = raw.map(o => parseObservation(o, now));
  const identities = new Map<string, string>();
  for (const o of [...current.flatMap(s => s.observation ? [s.observation] : []), ...incoming]) {
    const data = evidenceContent(o);
    if (identities.has(o.observationId) && identities.get(o.observationId) !== data) throw new Error("Invalid reused observation ID with conflicting content.");
    identities.set(o.observationId, data);
  }
  const slots = new Map(expireSlots(current, now).map(s => [slotKey(s), s]));
  for (const o of incoming) {
    if (selection && !isSelected(o, selection)) continue;
    const key = slotKey(o), old = slots.get(key);
    if (now >= observationExpiresAt(o)) {
      if (!old?.observation) slots.set(key, emptySlot(o, true));
      continue;
    }
    if (old?.observation?.observationId === o.observationId) {
      if (!old.observation.submission && o.submission) slots.set(key, { ...old, observation: o });
      continue;
    }
    if (old?.observation && compareEvidence(o, old.observation) <= 0) continue;
    slots.set(key, { ...emptySlot(o), observation: o });
  }
  return ordered(slots.values());
}
export interface ManualEntry extends Slot, ManualTime { killedBy?: string; observedByCharacter?: string }
export function manualObservation(entry: ManualEntry, now: number, replacesObservationId?: string): Observation {
  const time = parseManualTime(entry, now);
  return parseObservation({ ...parseSlot(entry), ...time, gatheredAt: now, observationId: crypto.randomUUID(), source: "manual",
    killedBy: entry.killedBy, observedByCharacter: entry.observedByCharacter, replacesObservationId }, now);
}
export function applyManual(current: readonly TimerSlot[], entry: ManualEntry, now: number, selection: Selection): TimerSlot[] {
  const slot = parseSlot(entry);
  if (!isSelected(slot, selection)) throw new Error("Invalid manual entry: this boss or region is not selected.");
  const replaced = current.find(s => slotKey(s) === slotKey(slot))?.observation?.observationId;
  const observation = manualObservation(entry, now, replaced);
  if (observationExpiresAt(observation) <= now) {
    const slots = new Map(expireSlots(current, now).map(s => [slotKey(s), s]));
    slots.set(slotKey(slot), emptySlot(slot, true)); return ordered(slots.values());
  }
  return mergeObservations(current, [observation], now, selection);
}
export function parseTimerState(raw: unknown, now: number): TimerSlot[] {
  if (!raw || typeof raw !== "object") throw new Error("Invalid timer file.");
  const file = raw as { schemaVersion: number; slots: unknown[] };
  if (![1, TIMER_SCHEMA].includes(file.schemaVersion) || !Array.isArray(file.slots) || file.slots.length > MAX_SLOTS) throw new Error("Invalid timer schema or capacity.");
  const labels = new Map<string, TimerSlot>(); const observations: Observation[] = [];
  for (const item of file.slots) {
    const slot = parseSlot(item); const saved = item as TimerSlot;
    if (typeof saved.outdated !== "boolean") throw new Error("Invalid empty timer state.");
    const key = slotKey(slot), previous = labels.get(key);
    labels.set(key, emptySlot(slot, saved.outdated || !!previous?.outdated));
    if (saved.observation !== undefined) {
      const observation = parseObservation(saved.observation, now);
      if (slotKey(observation) !== key) throw new Error("Invalid observation slot mismatch.");
      observations.push(observation);
    }
  }
  return mergeObservations(ordered(labels.values()), observations, now);
}
