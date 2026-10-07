import { closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, renameSync, rmSync, statSync, writeFileSync, writeSync } from "node:fs";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join, resolve, sep } from "node:path";
import { pcapPackets } from "../spiritvale/pcap";

const LIMIT = 128 * 1024 * 1024;
const SESSION = /^monitor-\d{4}-\d{2}-\d{2}T[\dTZ-]+-[a-f0-9]{8}(?:_clean)?$/;
type Row = { at?: string; event: string; value?: any };
type Packet = { protocol: string; sourceIP: string; destinationIP: string; sourcePort: number; destinationPort: number; capturedAt?: string | Date };
type Range = { first: number; last: number };
export interface RecordingReport { processed: number; skipped: number; failed: number; errors: { session: string; reason: string }[] }

function child(root: string, name: string) {
  const base = resolve(root), path = resolve(base, name);
  if (!path.startsWith(base + sep) || name.includes("/") || name.includes("\\") || name.includes(":")) throw new Error("Unsafe recording path.");
  if (existsSync(path)) {
    if (lstatSync(path).isSymbolicLink() || !realpathSync(path).toLowerCase().startsWith(realpathSync(base).toLowerCase() + sep)) throw new Error("Linked recordings are not supported.");
  }
  return path;
}
function boundedFile(folder: string, name: string) {
  const path = child(folder, name);
  if (!statSync(path).isFile() || statSync(path).size > LIMIT) throw new Error("Recording file exceeds limits.");
  return path;
}
function writeAll(fd: number, data: Buffer | string) {
  const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
  let offset = 0; while (offset < buffer.length) { const count = writeSync(fd, buffer, offset, buffer.length - offset); if (count <= 0) throw new Error("Recording write failed."); offset += count; }
}
async function* rows(folder: string) {
  const input = createReadStream(boundedFile(folder, "events.jsonl"));
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    for await (const line of lines) {
      if (!line.trim()) continue;
      if (line.length > 1024 * 1024) throw new Error("Recording event exceeds limits.");
      const row = JSON.parse(line) as Row;
      if (!row || typeof row !== "object" || typeof row.event !== "string") throw new Error("Invalid recording event.");
      yield { row, line };
    }
  } finally { lines.close(); input.destroy(); }
}
function packet(row: Row): Packet | undefined {
  if (row.event === "transportPacket") return row.value;
  if (row.event === "fishNetPacket") return row.value?.liteNetPacket?.udpPacket;
  if (row.event === "liteNetPacket") return row.value?.udpPacket;
  if (row.event === "trace" && row.value?.stage === "attribution") return row.value;
  if (row.event === "trace") return row.value?.packet?.udpPacket ?? row.value?.packet;
}
function key(p?: Packet) {
  if (!p || !["udp", "tcp"].includes(p.protocol) || typeof p.sourceIP !== "string" || typeof p.destinationIP !== "string"
    || !Number.isInteger(p.sourcePort) || !Number.isInteger(p.destinationPort) || p.sourcePort < 0 || p.sourcePort > 65535 || p.destinationPort < 0 || p.destinationPort > 65535) return undefined;
  const endpoints = [[p.sourceIP, p.sourcePort], [p.destinationIP, p.destinationPort]].map(value => JSON.stringify(value)).sort();
  return JSON.stringify([p.protocol, ...endpoints]);
}
function timestamp(p: Packet, fallback?: string) { return new Date(p.capturedAt ?? fallback ?? "").getTime(); }
function matches(p: Packet | undefined, flows: Map<string, Range>, at?: string) {
  const flow = key(p); if (!flow || !p) return false;
  const range = flows.get(flow), time = timestamp(p, at);
  return !!range && Number.isFinite(time) && time >= range.first - 2000 && time <= range.last + 2000;
}
const contextEvents = new Set(["recording-start", "health", "targetStatus", "connection", "capture-event", "warning", "driver-error", "runtime-error",
  "capture-started", "capture-unavailable", "capture-recovery", "capture-warning", "capture-packet-rejected"]);
const contextStages = new Set(["driver-state", "process-endpoints", "npcap-stats"]);
async function cleanSession(source: string, destination: string, name: string) {
  const flows = new Map<string, Range>();
  for await (const { row } of rows(source)) {
    const attributed = ["transportPacket", "fishNetPacket", "liteNetPacket"].includes(row.event)
      || row.event === "trace" && row.value?.stage === "attribution" && ["inbound", "outbound"].includes(row.value?.targetDirection);
    if (!attributed) continue;
    const p = packet(row), flow = key(p); if (!p || !flow) continue;
    const time = timestamp(p, row.at); if (!Number.isFinite(time)) continue;
    const range = flows.get(flow); flows.set(flow, { first: Math.min(range?.first ?? time, time), last: Math.max(range?.last ?? time, time) });
    if (flows.size > 16384) throw new Error("Too many recording flows.");
  }
  if (!flows.size) throw new Error("No attributed Spirit Vale traffic; original recording preserved.");
  const summary = JSON.parse(readFileSync(boundedFile(source, "summary.json"), "utf8"));
  mkdirSync(destination);
  let frames = 0, removedFrames = 0, events = 0, removedEvents = 0;
  const eventFd = openSync(child(destination, "events.jsonl"), "wx");
  try {
    for await (const { row, line } of rows(source)) {
      const keep = contextEvents.has(row.event) || row.event === "trace" && contextStages.has(row.value?.stage) || matches(packet(row), flows, row.at);
      if (keep) { writeAll(eventFd, line + "\n"); events++; } else removedEvents++;
    }
  } finally { closeSync(eventFd); }
  for (const file of readdirSync(source).filter(file => /^wire-\d+\.pcap$/.test(file))) {
    const data = readFileSync(boundedFile(source, file));
    const fd = openSync(child(destination, file), "wx");
    try {
      writeAll(fd, data.subarray(0, 24));
      let chunks: Buffer[] = [], bytes = 0;
      for (const frame of pcapPackets(data)) {
        if (!matches(frame.packet, flows)) { removedFrames++; continue; }
        chunks.push(frame.record); bytes += frame.record.length; frames++;
        if (bytes >= 256 * 1024) { writeAll(fd, Buffer.concat(chunks, bytes)); chunks = []; bytes = 0; }
      }
      if (bytes) writeAll(fd, Buffer.concat(chunks, bytes));
    } finally { closeSync(fd); }
  }
  if (!frames) throw new Error("No attributable raw frames; original recording preserved.");
  const session = name + "_clean";
  writeFileSync(child(destination, "summary.json"), JSON.stringify({ ...summary, active: false, session, frames, events,
    archive: session + ".zip", optimized: true, sourceSession: name, optimizedAt: new Date().toISOString(), removedFrames, removedEvents,
    bytes: readdirSync(destination).reduce((sum, file) => sum + statSync(child(destination, file)).size, 0),
    note: "Only flows attributed to Spirit Vale were retained. Game/player data may remain; review before sharing." }, null, 2) + "\n");
}
export async function zipRecording(folder: string, output: string) {
  const command = 'Add-Type -AssemblyName System.IO.Compression.FileSystem; [IO.Compression.ZipFile]::CreateFromDirectory($env:MVP_RECORDING_SOURCE,$env:MVP_RECORDING_ZIP,[IO.Compression.CompressionLevel]::Fastest,$false)';
  const child = Bun.spawn(["powershell.exe", "-NoProfile", "-Command", command], { env: { ...process.env, MVP_RECORDING_SOURCE: folder, MVP_RECORDING_ZIP: output }, stdin: "ignore", stdout: "ignore", stderr: "pipe", windowsHide: true });
  const error = await new Response(child.stderr).text();
  if (await child.exited) throw new Error("Recording ZIP failed: " + error.slice(-1024));
}

/** All removals resolve inside the known recordings directory; active/linked/unrelated files are preserved. */
export async function maintainRecordings(logsRoot: string, action: "optimize" | "clear", activeSession?: string, archive = zipRecording): Promise<RecordingReport> {
  const root = resolve(logsRoot, "recordings"); mkdirSync(root, { recursive: true });
  if (lstatSync(root).isSymbolicLink()) throw new Error("Linked recordings directory is not supported.");
  const report: RecordingReport = { processed: 0, skipped: 0, failed: 0, errors: [] };
  const names = readdirSync(root).sort();
  for (const name of names) {
    const stem = name.replace(/\.zip$/, "");
    if (!SESSION.test(stem)) continue;
    if (stem === activeSession) { report.skipped++; continue; }
    try {
      const path = child(root, name);
      if (action === "clear") {
        if (name.endsWith(".zip") && statSync(path).isFile() || statSync(path).isDirectory()) { rmSync(path, { recursive: true, force: true }); report.processed++; }
        continue;
      }
      if (!statSync(path).isDirectory()) continue;
      if (existsSync(child(root, name + ".zip"))) { report.skipped++; continue; }
      const summary = JSON.parse(readFileSync(boundedFile(path, "summary.json"), "utf8"));
      if (summary.active !== false) { report.skipped++; continue; }
      const cleanName = name.endsWith("_clean") ? name : name + "_clean", clean = child(root, cleanName);
      if (!name.endsWith("_clean") && existsSync(clean)) { report.skipped++; continue; }
      if (!name.endsWith("_clean")) {
        const stage = child(root, cleanName + ".tmp-" + crypto.randomUUID());
        try { await cleanSession(path, stage, name); renameSync(stage, clean); }
        finally { if (existsSync(stage)) rmSync(stage, { recursive: true, force: true }); }
      }
      const zip = child(root, cleanName + ".zip"), temporary = child(root, cleanName + ".zip.tmp");
      try { if (existsSync(temporary)) rmSync(temporary); await archive(clean, temporary); renameSync(temporary, zip); }
      finally { if (existsSync(temporary)) rmSync(temporary); }
      // Keep originals until a complete optimized archive exists, including retry after ZIP failure.
      const sourceName = name.endsWith("_clean") ? name.slice(0, -6) : name;
      if (typeof sourceName === "string" && SESSION.test(sourceName) && sourceName !== activeSession && sourceName !== cleanName && existsSync(child(root, sourceName))) rmSync(child(root, sourceName), { recursive: true, force: true });
      report.processed++;
    } catch (error) { report.failed++; report.errors.push({ session: name, reason: (error as Error).message.slice(0, 300) }); }
  }
  return report;
}
