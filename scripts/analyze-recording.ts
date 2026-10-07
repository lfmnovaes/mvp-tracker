import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pcapPackets } from "../src/spiritvale/pcap";
import { FishNetTransportReplay, decodeBossGravestone } from "../src/spiritvale";
const directory = process.argv[2];
if (!directory) throw new Error("Usage: bun run analyze:recording <extracted recording folder>");
const root = resolve(directory), replay = new FishNetTransportReplay();
const counts: Record<string, number> = {}, unknownRpc: Record<string, number> = {};
const report = { frames: 0, udp: 0, tcp: 0, truncated: 0, graves: 0, interruptedFiles: 0, gameEndpointDatagrams: 0, packets: counts, unknownRpc };
const gamePorts = new Set<number>();
try {
  const events = join(root, "events.jsonl"); if (statSync(events).size > 128 * 1024 * 1024) throw new Error("Recording exceeds limits.");
  for (const line of readFileSync(events, "utf8").split("\n")) {
    try { const row = JSON.parse(line); if (row.event === "trace" && row.value?.stage === "process-endpoints") for (const endpoint of row.value.snapshot?.endpoints ?? []) if (endpoint.protocol === "udp" && Number.isInteger(endpoint.port) && endpoint.port >= 0 && endpoint.port <= 65535) gamePorts.add(endpoint.port); } catch {}
  }
} catch { /* An interrupted session may still have usable PCAP frames. */ }
for (const name of readdirSync(root).filter(name => /^wire-\d+\.pcap$/.test(name)).sort((a, b) => a.localeCompare(b, "en", { numeric: true }))) {
  const path = join(root, name); if (statSync(path).size > 128 * 1024 * 1024) throw new Error("Recording exceeds limits.");
  try {
    for (const frame of pcapPackets(readFileSync(path))) {
      report.frames++; if (frame.truncated) report.truncated++;
      const p = frame.packet; if (!p) continue;
      if (p.protocol === "tcp") { report.tcp++; continue; }
      report.udp++;
      const game = gamePorts.has(p.sourcePort) || gamePorts.has(p.destinationPort); if (game) report.gameEndpointDatagrams++;
      // Include unowned relay flows only when explicitly requested for forensic review.
      if (!game && !process.argv.includes("--all-udp")) continue;
      replay.consumeRecord({ type: "transport.packet", recordedAt: p.capturedAt.toISOString(), data: { ...p, payloadHex: p.payload.toString("hex") } }, packet => {
        counts[packet.packetName] = (counts[packet.packetName] ?? 0) + 1;
        if (decodeBossGravestone(packet)) report.graves++;
        if (!packet.rpcName && packet.rpcHash !== undefined) { const key = `${packet.packetName}/${packet.networkBehaviourIndex}/${packet.rpcHash}`; unknownRpc[key] = (unknownRpc[key] ?? 0) + 1; }
      });
    }
  } catch { report.interruptedFiles++; }
}
console.log(JSON.stringify({ ...report, replay: replay.stats(), note: "Offline baseline decoding only; no timers were imported or modified. No names, IPs or payloads are printed." }, null, 2));
