import { gzipSync, gunzipSync } from "node:zlib";
import { bossById, CATALOG_VERSION, CHANNELS, isSelected, REGIONS, type Selection } from "../domain/catalog";
import { observationExpiresAt, compareEvidence, expireSlots, MAX_SLOTS, mergeObservations, parseObservation, slotKey, type Observation, type TimerSlot } from "../domain/timers";
import { CLOCK_SKEW, formatClock, TIME_ZONE } from "../domain/time";
import { EXCHANGE_LIMIT, type ExportFormat, type ImportSummary } from "../shared/exchange";
const PREFIX = "MVPT1:";

function selected(slots: readonly TimerSlot[], selection: Selection, now: number): Observation[] {
  return slots.flatMap(s => s.observation && isSelected(s, selection) && now < observationExpiresAt(s.observation) ? [parseObservation(s.observation, now)] : [])
    .sort((a, b) => slotKey(a).localeCompare(slotKey(b), "en"));
}
export function exportTimers(slots: readonly TimerSlot[], selection: Selection, now: number, format: ExportFormat): { text: string; count: number } {
  let observations = selected(slots, selection, now);
  if (format === "text") {
    observations = observations.filter(o => o.source !== 'alive' && bossById(o.mobId)?.endgame);
    const sections: string[] = [];
    for (const region of REGIONS) {
      const lines: string[] = [];
      for (const channel of CHANNELS) {
        const entries = observations.filter(o => o.region === region && o.channel === channel).sort((a, b) => a.diedAt! - b.diedAt! || a.mobId.localeCompare(b.mobId, "en"));
        if (entries.length) lines.push(`Ch${channel}: ${entries.map(o => `${formatClock(o.diedAt!, true)}(${bossById(o.mobId)!.textCode})`).join(" - ")}`);
      }
      if (lines.length) sections.push(`${region.toUpperCase()} UTC-3\n${lines.join("\n")}`);
    }
    return { text: sections.join("\n\n"), count: observations.length };
  }
  // Canonical domain objects deliberately exclude settings, keys and native state.
  const json = JSON.stringify({ format: "mvp-tracker", schemaVersion: 2, catalogVersion: CATALOG_VERSION,
    exportedAt: now, timeZone: TIME_ZONE, timestampUnit: "unix-ms", observations }, null, format === "json" ? 2 : undefined);
  if (Buffer.byteLength(json) > EXCHANGE_LIMIT) throw new Error("Export is too large.");
  return { text: format === "compressed" ? PREFIX + gzipSync(Buffer.from(json)).toString("base64url") : json, count: observations.length };
}
// Reject excessive nesting before JSON.parse allocates a deeply nested object graph.
function checkDepth(text: string) {
  let depth = 0, quoted = false, escaped = false;
  for (const char of text) {
    if (quoted) { if (escaped) escaped = false; else if (char === "\\") escaped = true; else if (char === '"') quoted = false; }
    else if (char === '"') quoted = true;
    else if (char === "{" || char === "[") { if (++depth > 8) throw new Error("Import nesting is too deep."); }
    else if (char === "}" || char === "]") depth--;
  }
}
export function decodeImport(input: string, now: number): Observation[] {
  if (typeof input !== "string" || input.length > EXCHANGE_LIMIT || Buffer.byteLength(input) > EXCHANGE_LIMIT) throw new Error("Import input is too large (500 KB maximum).");
  let text = input.trim();
  if (text.startsWith(PREFIX)) {
    const encoded = text.slice(PREFIX.length);
    if (!encoded || !/^[A-Za-z0-9_-]+$/.test(encoded) || encoded.length % 4 === 1) throw new Error("Import has invalid base64url data.");
    const bytes = Buffer.from(encoded, "base64url");
    if (bytes.toString("base64url") !== encoded || bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error("Import has invalid compressed data.");
    try {
      // Native zlib bounds the expanded buffer and verifies the gzip checksum.
      const decoded = gunzipSync(bytes, { maxOutputLength: EXCHANGE_LIMIT });
      if (decoded.length > EXCHANGE_LIMIT) throw new Error("Output limit");
      text = new TextDecoder("utf-8", { fatal: true }).decode(decoded).trim();
    } catch { throw new Error("Import compressed data is corrupt or exceeds the 500 KB expanded limit."); }
  } else if (text.startsWith("MVPT")) throw new Error("Import compressed version is not supported.");
  else if (!text.startsWith("{")) throw new Error("Import accepts MVP Tracker JSON or MVPT1 compressed data. Compact text is not importable.");
  checkDepth(text);
  let value: any;
  try { value = JSON.parse(text); } catch { throw new Error("Import JSON is invalid."); }
  if (!value || value.format !== "mvp-tracker" || ![1, 2].includes(value.schemaVersion) || value.catalogVersion !== CATALOG_VERSION
    || value.timestampUnit !== "unix-ms" || value.timeZone !== TIME_ZONE || !Number.isSafeInteger(value.exportedAt) || value.exportedAt < 0 || value.exportedAt > now + CLOCK_SKEW
    || !Array.isArray(value.observations) || value.observations.length > MAX_SLOTS) throw new Error("Import schema, version, export time or record count is invalid.");
  const observations = value.observations.map((o: unknown) => parseObservation(o, now));
  mergeObservations([], observations, now); // Validate ID/content conflicts across the whole batch.
  return observations;
}
export function previewImport(current: readonly TimerSlot[], incoming: readonly Observation[], selection: Selection, now: number): { summary: ImportSummary; observations: Observation[] } {
  // Validate even ignored records and detect altered IDs against current evidence.
  mergeObservations(current, incoming, now, selection);
  const summary: ImportSummary = { total: incoming.length, added: 0, refreshed: 0, ignored: 0, conflicted: 0, disabled: 0, expired: 0 };
  const winners = new Map<string, Observation>();
  for (const o of incoming) {
    if (!isSelected(o, selection)) { summary.disabled++; continue; }
    if (now >= observationExpiresAt(o)) { summary.expired++; continue; }
    const key = slotKey(o), previous = winners.get(key);
    if (previous) summary.ignored++;
    if (!previous || compareEvidence(o, previous) > 0) winners.set(key, o);
  }
  const local = new Map(expireSlots(current, now).map(s => [slotKey(s), s.observation]));
  const observations: Observation[] = [];
  for (const [key, o] of winners) {
    const old = local.get(key);
    if (old && old.gatheredAt === o.gatheredAt && old.observationId !== o.observationId) summary.conflicted++;
    if (old && compareEvidence(o, old) <= 0) { summary.ignored++; continue; }
    if (old) summary.refreshed++; else summary.added++;
    observations.push(o);
  }
  return { summary, observations };
}
