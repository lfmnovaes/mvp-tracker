import { isSelected, type Selection } from "./catalog";
import { observationExpiresAt, emptySlot, expireSlots, MAX_SLOTS, mergeObservations, parseObservation, parseSlot, slotKey, type Observation, type TimerSlot } from "./timers";
import type { Dataset, SyncResult } from "../shared/sharing";
export interface SyncCache { connectionId: string; selection: string; dataset: Dataset; known: Record<string, string>; resetRequest?: { id: string; dataset: Dataset } }
export function parseDataset(raw: Dataset): Dataset {
  if (!raw || typeof raw.datasetId !== "string" || !raw.datasetId || raw.datasetId.length > 160 || ![raw.generation, raw.revision, raw.resetAt].every(n => Number.isSafeInteger(n) && n >= 0) || raw.generation < 1) throw new Error("Sharing: invalid dataset metadata.");
  return { datasetId: raw.datasetId, generation: raw.generation, revision: raw.revision, resetAt: raw.resetAt };
}
export function parseSyncCache(raw: SyncCache): SyncCache {
  if (!raw || !/^[a-f0-9]{64}$/.test(raw.connectionId) || typeof raw.selection !== "string" || raw.selection.length > 4096 || !raw.known || Object.keys(raw.known).length > MAX_SLOTS) throw new Error("Invalid sync cache.");
  for (const [key, id] of Object.entries(raw.known)) if (key.length > 320 || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error("Invalid sync cache.");
  const resetRequest = raw.resetRequest;
  if (resetRequest && !/^[A-Za-z0-9_-]{1,80}$/.test(resetRequest.id)) throw new Error("Invalid reset receipt.");
  return { connectionId: raw.connectionId, selection: raw.selection, dataset: parseDataset(raw.dataset), known: { ...raw.known }, ...(resetRequest ? { resetRequest: { id: resetRequest.id, dataset: parseDataset(resetRequest.dataset) } } : {}) };
}
export function validateSyncResult(raw: SyncResult, now: number): SyncResult {
  const dataset = parseDataset(raw?.dataset);
  if (raw.pruneOutdated !== undefined && (typeof raw.pruneOutdated !== "boolean" || raw.pruneOutdated && !raw.full)) throw new Error("Sharing: invalid cleanup response.");
  if (!raw || typeof raw.full !== "boolean" || !Number.isSafeInteger(raw.serverTime) || Math.abs(raw.serverTime - now) > 30000 || dataset.resetAt > raw.serverTime || !Array.isArray(raw.slots) || raw.slots.length > MAX_SLOTS || !Array.isArray(raw.acknowledged) || raw.acknowledged.length > MAX_SLOTS) throw new Error("Sharing: invalid sync response or system clock.");
  const keys = new Set<string>();
  const slots = raw.slots.map(row => {
    const slot = parseSlot(row), key = slotKey(slot);
    if (keys.has(key) || typeof row.outdated !== "boolean" || !Number.isSafeInteger(row.revision) || row.revision < 1 || row.revision > dataset.revision) throw new Error("Sharing: invalid sync rows."); keys.add(key);
    const observation = row.observation && parseObservation(row.observation, now);
    if (observation && slotKey(observation) !== key) throw new Error("Sharing: mismatched sync slot.");
    return { ...slot, outdated: row.outdated, revision: row.revision, ...(observation ? { observation } : {}) };
  });
  for (const id of raw.acknowledged) if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(id)) throw new Error("Sharing: invalid acknowledgements.");
  return { dataset, serverTime: raw.serverTime, full: raw.full, slots, acknowledged: [...raw.acknowledged], ...(raw.pruneOutdated ? { pruneOutdated: true } : {}) };
}
export function pendingUploads(slots: TimerSlot[], cache: SyncCache | undefined, selection: Selection, now: number): Observation[] {
  return slots.flatMap(s => s.observation && isSelected(s, selection) && observationExpiresAt(s.observation) > now && s.observation.gatheredAt > (cache?.dataset.resetAt ?? 0) && cache?.known[slotKey(s)] !== s.observation.observationId ? [s.observation] : []);
}
export function applySync(current: TimerSlot[], previous: SyncCache | undefined, raw: SyncResult, outgoing: Observation[], connectionId: string, selectionKey: string, selection: Selection, now: number): { slots: TimerSlot[]; cache: SyncCache } {
  const result = validateSyncResult(raw, now), dataset = result.dataset;
  const same = previous?.connectionId === connectionId && previous.dataset.datasetId === dataset.datasetId && previous.dataset.generation === dataset.generation;
  if (!result.full && (!same || dataset.revision < previous!.dataset.revision)) throw new Error("Sharing: a full snapshot is required.");
  const known: Record<string, string> = same ? { ...previous.known } : {};
  const ack = new Set(result.acknowledged);
  for (const o of outgoing) if (ack.has(o.observationId)) known[slotKey(o)] = o.observationId;
  const observations = result.slots.flatMap(s => s.observation && isSelected(s, selection) ? [s.observation] : []);
  for (const row of result.slots) { if (row.observation) known[slotKey(row)] = row.observation.observationId; else delete known[slotKey(row)]; }
  // Reset invalidates old evidence, not kills that are freshly observed afterward.
  const base = expireSlots(current, now).map(s => s.observation && s.observation.gatheredAt <= dataset.resetAt ? emptySlot(s, true) : s);
  let slots = mergeObservations(base, observations, now, selection);
  // The authenticated/origin-bound server is authoritative for submission metadata, never evidence time.
  const remote = new Map(observations.map(o => [o.observationId, o]));
  slots = slots.map(s => s.observation && remote.has(s.observation.observationId) ? { ...s, observation: { ...s.observation, submission: remote.get(s.observation.observationId)!.submission } } : s);
  const labels = new Map(slots.map(s => [slotKey(s), s]));
  for (const row of result.slots) if (!row.observation && isSelected(row, selection) && !labels.has(slotKey(row))) labels.set(slotKey(row), emptySlot(row, row.outdated));
  return { slots: [...labels.values()].filter(s => !result.pruneOutdated || s.observation || !s.outdated), cache: { connectionId, selection: selectionKey, dataset, known } };
}
