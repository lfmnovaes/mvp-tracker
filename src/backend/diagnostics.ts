import type { Snapshot } from "../shared/protocol";
import { release } from "node:os";
import type { LogRecord } from "./logger";
export const TOOLS_VERSIONS = { capture: "3.0.2", character: "0.6.1" } as const;
// Deliberately construct exports field-by-field. Never copy native error strings,
// adapter descriptions, names, settings, timers or paths into a diagnostic report.
export function healthSample(snapshot: Snapshot, at: number) {
  const c = snapshot.capture;
  return { at, capture: c.state, game: c.game, adapterSelected: !!c.adapter,
    adaptersAvailable: c.devices.length, lastPacketAt: c.lastPacketAt,
    retryAt: c.retryAt, skipped: c.skipped, unresolved: c.unresolved,
    backendConnected: true, trayReady: snapshot.trayReady, storageWritable: snapshot.storageWritable,
    sharing: snapshot.sharing ? { configured: snapshot.sharing.configured, state: snapshot.sharing.state } : undefined,
    sync: snapshot.sync ? { phase: snapshot.sync.phase, running: snapshot.sync.running, interval: snapshot.sync.interval, busy: snapshot.sync.busy, lastAt: snapshot.sync.lastAt } : undefined };
}
export class Diagnostics {
  until = 0;
  private last = 0;
  private samples: ReturnType<typeof healthSample>[] = [];
  start(now: number) { this.until = now + 300000; this.last = 0; this.samples = []; }
  stop() { this.until = 0; }
  tick(snapshot: Snapshot, now: number) {
    if (now >= this.until || this.last > now) { this.stop(); return; }
    if (now - this.last < 10000) return;
    this.last = now; this.samples.push(healthSample(snapshot, now));
    if (this.samples.length > 30) this.samples.shift();
  }
  report(snapshot: Snapshot, events: LogRecord[], now: number) {
    return JSON.stringify({ schemaVersion: 2, version: snapshot.version, tools: TOOLS_VERSIONS,
      runtime: { bun: process.versions.bun, node: process.versions.node, os: release(), arch: process.arch },
      platform: "Windows x64", generatedAt: new Date(now).toISOString(),
      health: healthSample(snapshot, now), events, samples: this.samples }, null, 2);
  }
}
