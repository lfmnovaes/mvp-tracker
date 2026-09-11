import { BOSSES, REGIONS, CHANNELS, defaultSelection, type Selection } from "../src/domain/catalog";
import { mergeObservations, type Observation } from "../src/domain/timers";
import { queryTimers } from "../src/domain/query";
import { exportTimers } from "../src/backend/exchange";
const now = Date.now();
for (const selection of [defaultSelection(), { bossIds: BOSSES.map(b => b.id), regions: [...REGIONS] } satisfies Selection]) {
  const observations: Observation[] = selection.bossIds.flatMap(mobId => selection.regions.flatMap(region => CHANNELS.map(channel => ({ mobId, region, channel, observationId: `${mobId}-${region}-${channel}`.replace(/[^A-Za-z0-9_-]/g, "_"), diedAt: now - 3600000, gatheredAt: now - 60000, source: "manual" as const, timePrecision: "second" as const }))));
  const slots = mergeObservations([], observations, now), timings: number[] = [];
  for (let i = 0; i < 25; i++) {
    const started = performance.now();
    mergeObservations(slots, observations.map(o => ({ ...o, gatheredAt: now, observationId: o.observationId + "-new" })), now);
    queryTimers(slots, selection, now, { search: "sa ch1", sort: { field: "status", direction: "asc" } });
    exportTimers(slots, selection, now, "compressed");
    timings.push(performance.now() - started);
  }
  timings.sort((a, b) => a - b);
  console.log(JSON.stringify({ slots: slots.length, operation: "merge-search-compressed-export", iterations: 25, medianMs: +timings[12]!.toFixed(2), maxMs: +timings.at(-1)!.toFixed(2), compressedBytes: Buffer.byteLength(exportTimers(slots, selection, now, "compressed").text) }));
}
