import { closeSync, fsyncSync, mkdirSync, openSync, writeSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { arch, cpus, freemem, release, totalmem } from "node:os";
import type { MonitorStatus } from "../shared/monitor";
import { VERSION } from "../shared/protocol";
import { TOOLS_VERSIONS } from "./diagnostics";

export interface WireFrame { capturedAt: Date; timestampTicks: bigint; data: Buffer; originalLength: number; dataLink: number }
export type TraceSink = (event: string, value: unknown) => void;
const MAX_BYTES = 128 * 1024 * 1024, MAX_DURATION = 10 * 60_000;
const MAX_FRAME = 65535, MAX_EVENT = 1024 * 1024;
// Intentionally detailed only while explicitly recording. Never route this into essential logs.
function json(value: unknown) {
  return JSON.stringify(value, (_key, value) => value?.type === "Buffer" && Array.isArray(value.data) ? { encoding: "base64", data: Buffer.from(value.data).toString("base64") } : typeof value === "bigint" ? value.toString()
    : value instanceof Error ? { name: value.name, message: value.message, stack: value.stack }
    : value, 0);
}
export class PacketRecording {
  private status: MonitorStatus = { active: false, until: 0, bytes: 0, frames: 0, events: 0, rejected: 0 };
  private directory?: string;
  private eventsFd?: number;
  private pcapFd?: number;
  private dataLink?: number;
  private segment = 0;
  private chunks: Buffer[] = [];
  private queued = 0;
  private lastHealth = 0;
  private sequence = 0;
  private failure?: { operation: string; error: unknown };
  constructor(private logsRoot: string, private now = Date.now, private maxBytes = MAX_BYTES, private duration = MAX_DURATION, private onFailure: (error: unknown) => void = () => {}) {}
  snapshot(): MonitorStatus { return { ...this.status }; }
  start(metadata: unknown = {}) {
    if (this.status.active || this.status.maintenance) throw new Error("A recording is already active or being optimized.");
    const session = `monitor-${new Date(this.now()).toISOString().replace(/[:.]/g, "-")}-${crypto.randomUUID().slice(0, 8)}`;
    this.directory = join(this.logsRoot, "recordings", session);
    mkdirSync(this.directory, { recursive: true });
    this.eventsFd = openSync(join(this.directory, "events.jsonl"), "wx");
    this.status = { active: true, until: this.now() + this.duration, session, bytes: 0, frames: 0, events: 0, rejected: 0 };
    this.failure = undefined; this.segment = 0; this.dataLink = undefined; this.sequence = 0; this.lastHealth = 0;
    this.chunks = []; this.queued = 0;
    this.event("recording-start", { schema: 1, version: VERSION, tools: TOOLS_VERSIONS, scope: "all TCP/UDP traffic on the selected adapter before attribution or decoding", computer: { os: release(), arch: arch(), cpu: cpus()[0]?.model, cpuCount: cpus().length, memory: totalmem() }, metadata });
    return this.snapshot();
  }
  private reserve(bytes: number) {
    if (!this.status.active) return false;
    if (this.now() >= this.status.until) { this.stop("time-limit"); return false; }
    if (this.status.bytes + bytes > this.maxBytes) { this.stop("size-limit"); return false; }
    return true;
  }
  event(event: string, value: unknown) {
    if (!this.status.active) return;
    try {
      const line = Buffer.from(json({ sequence: ++this.sequence, at: new Date(this.now()).toISOString(), event, value }) + "\n");
      if (line.length > MAX_EVENT) { this.status.rejected++; return; }
      if (!this.reserve(line.length)) return;
      this.writeAll(this.eventsFd!, line); this.status.bytes += line.length; this.status.events++;
    } catch (error) { this.fail(error, "write-event"); }
  }
  private fail(error: unknown, operation: string) { this.failure = { operation, error }; this.stop("storage-error"); try { this.onFailure(error); } catch {} }
  private writeAll(fd: number, buffer: Buffer) {
    let offset = 0;
    while (offset < buffer.length) { const written = writeSync(fd, buffer, offset, buffer.length - offset); if (written <= 0) throw new Error("Recording write failed."); offset += written; }
  }
  frame(frame: WireFrame) {
    if (!this.status.active) return;
    // Npcap timestamps are Unix 100-ns ticks; preserve microseconds in standard PCAP.
    const micros = frame.timestampTicks / 10n, seconds = micros / 1_000_000n, fraction = micros % 1_000_000n;
    if (frame.data.length > MAX_FRAME || !Number.isInteger(frame.originalLength) || frame.originalLength < frame.data.length || frame.originalLength > 0xffffffff
      || !Number.isInteger(frame.dataLink) || frame.dataLink < 0 || seconds < 0n || seconds > 0xffffffffn || fraction < 0n) { this.status.rejected++; return; }
    const newSegment = this.dataLink !== frame.dataLink;
    if (!this.reserve(16 + frame.data.length + (newSegment ? 24 : 0))) return;
    try {
      if (newSegment) {
        this.flush(); if (this.pcapFd !== undefined) { fsyncSync(this.pcapFd); closeSync(this.pcapFd); }
        const header = Buffer.alloc(24); header.writeUInt32LE(0xa1b2c3d4); header.writeUInt16LE(2, 4); header.writeUInt16LE(4, 6); header.writeUInt32LE(MAX_FRAME, 16); header.writeUInt32LE(frame.dataLink === 12 ? 101 : frame.dataLink, 20);
        this.pcapFd = openSync(join(this.directory!, `wire-${++this.segment}.pcap`), "wx"); this.dataLink = frame.dataLink;
        this.writeAll(this.pcapFd, header); this.status.bytes += header.length;
      }
      const record = Buffer.alloc(16 + frame.data.length);
      record.writeUInt32LE(Number(seconds)); record.writeUInt32LE(Number(fraction), 4); record.writeUInt32LE(frame.data.length, 8); record.writeUInt32LE(frame.originalLength, 12); frame.data.copy(record, 16);
      this.chunks.push(record); this.queued += record.length; this.status.bytes += record.length; this.status.frames++;
      if (this.queued >= 256 * 1024) this.flush();
    } catch (error) { this.fail(error, "write-pcap"); }
  }
  flush() {
    if (!this.queued || this.pcapFd === undefined) return;
    this.writeAll(this.pcapFd, Buffer.concat(this.chunks, this.queued)); this.chunks = []; this.queued = 0;
  }
  tick(health: unknown) {
    if (!this.status.active) return;
    if (this.now() >= this.status.until) { this.stop("time-limit"); return; }
    try { this.flush(); } catch (error) { this.fail(error, "flush-pcap"); return; }
    if (this.now() - this.lastHealth >= 1000) { this.lastHealth = this.now(); this.event("health", { freeMemory: freemem(), processMemory: process.memoryUsage(), cpu: process.cpuUsage(), health }); }
  }
  stop(reason = "user") {
    if (!this.status.active) return this.snapshot();
    this.status.active = false; this.status.until = 0; this.status.reason = reason;
    try { this.flush(); } catch (error) { this.failure = { operation: "stop-flush", error }; this.status.reason = "storage-error"; }
    this.chunks = []; this.queued = 0;
    for (const fd of [this.pcapFd, this.eventsFd]) if (fd !== undefined) { try { fsyncSync(fd); } catch (error) { this.failure = { operation: "fsync", error }; this.status.reason = "storage-error"; try { this.onFailure(error); } catch {} } try { closeSync(fd); } catch {} }
    this.pcapFd = this.eventsFd = undefined;
    try { writeFileSync(join(this.directory!, "summary.json"), json({ schema: 1, ...this.status, stoppedAt: new Date(this.now()).toISOString(), segments: this.segment, failure: this.failure, note: "Raw adapter traffic may contain private data. Only share intentionally. No data was uploaded." }) + "\n"); }
    catch { this.status.reason = "storage-error"; }
    return this.snapshot();
  }
  async maintain(action: "optimize" | "clear") {
    if (this.status.maintenance) throw new Error("Recording maintenance is already running.");
    this.status.maintenance = action; this.status.message = undefined;
    try {
      const worker = join(import.meta.dir, import.meta.path.endsWith(".ts") ? "recording-worker.ts" : "recording-worker.js");
      const child = Bun.spawn([process.execPath, worker, action, this.logsRoot, this.status.active ? this.status.session! : ""], { stdin: "ignore", stdout: "pipe", stderr: "pipe", windowsHide: true });
      const [out, error, exit] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
      if (exit) throw new Error("Recording maintenance failed: " + error.slice(-1024));
      const report = JSON.parse(out) as import("./recording-files").RecordingReport;
      this.status.message = (action === "clear" ? "Cleared " : "Optimized ") + report.processed + " · skipped " + report.skipped + " · failed " + report.failed + (report.errors[0] ? ". " + report.errors[0].reason : ".");
      if (action === "clear" && !this.status.active) this.status.session = undefined;
      return report;
    } catch (error) { this.status.message = (error as Error).message; try { this.onFailure(error); } catch {} throw error; }
    finally { this.status.maintenance = undefined; }
  }
}
