// Opt-in destructive checks. No deploy key is accepted by this player-side test.
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { parseConnection } from "../src/shared/sharing";
import { validateDiscovery } from "../src/backend/sharing";
const config = parseConnection({ url: process.env.MVP_INTEGRATION_URL ?? "", groupKey: process.env.MVP_INTEGRATION_KEY ?? "" });
if (!config.url || process.env.MVP_INTEGRATION_ALLOW_RESET !== "YES_DISPOSABLE") throw new Error("Integration disabled. Configure a disposable deployment and explicit reset opt-in.");
const client = new ConvexHttpClient(config.url, { logger: false, fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
  if (new URL(String(input)).origin !== config.url) throw new Error("Unexpected destination.");
  return fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
}) as typeof fetch });
const access = { key: config.groupKey, protocol: 1 };
try {
  const info = validateDiscovery(await client.query(api.timers.testConnection, access));
  if (!info.disposable || !info.dataset) throw new Error("Refusing: deployment is not marked as initialized and disposable.");
  const reset = await client.mutation(api.timers.reset, { ...access, ...{ datasetId: info.dataset.datasetId, generation: info.dataset.generation }, requestId: crypto.randomUUID() });
  const at = Date.now() + 1; await Bun.sleep(5);
  const base = { mobId: "NightmarePaladinBoss", region: "sa", channel: 1, source: "manual" as const, timePrecision: "millisecond" as const, diedAt: at, gatheredAt: at };
  const args = { ...access, datasetId: reset.datasetId, generation: reset.generation, sinceRevision: null, sentByCharacter: "Integration fixture" };
  await Promise.all(["a", "z"].map(suffix => client.mutation(api.timers.sync, { ...args, requestId: crypto.randomUUID(), observations: [{ ...base, observationId: `${at}_${suffix}` }] }, { skipQueue: true })));
  const snapshot = await client.query(api.timers.snapshot, { ...access, datasetId: reset.datasetId, generation: reset.generation });
  if (snapshot.slots.length !== 1 || snapshot.slots[0]?.observation?.observationId !== `${at}_z`) throw new Error("Concurrent merge did not converge.");
  await client.mutation(api.timers.reset, { ...access, datasetId: reset.datasetId, generation: reset.generation, requestId: crypto.randomUUID() });
  console.log("Disposable integration passed: concurrent same-slot merge converged; fixture data reset.");
} catch { throw new Error("Disposable integration failed. Inspect the test deployment; no credentials or remote error text are printed here."); }
