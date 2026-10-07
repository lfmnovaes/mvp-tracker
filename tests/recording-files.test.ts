import { afterEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PacketRecording } from "../src/backend/packet-recording";
import { maintainRecordings } from "../src/backend/recording-files";
import { pcapPackets } from "../src/spiritvale/pcap";
const roots: string[] = [];
const now = 1791336000123;
function setup() { const root = mkdtempSync(join(tmpdir(), "mvp-recording-files-")); roots.push(root); return { root, recorder: new PacketRecording(root, () => now) }; }
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
function udp(port: number) {
  const data = Buffer.alloc(29); data[0] = 0x45; data.writeUInt16BE(29, 2); data[9] = 17;
  data.set([192, 0, 2, 1], 12); data.set([192, 0, 2, 2], 16);
  data.writeUInt16BE(port, 20); data.writeUInt16BE(6000, 22); data.writeUInt16BE(9, 24); data[28] = 255;
  return { data, originalLength: 29, dataLink: 12, capturedAt: new Date(now), timestampTicks: BigInt(now) * 10000n + 4560n };
}
function record(recorder: PacketRecording, attributed = true) {
  recorder.start(); recorder.frame(udp(5000)); recorder.frame(udp(7000));
  // Same ports on a different remote endpoint, and a reused flow outside the attribution window.
  const otherHost = udp(5000); otherHost.data[19] = 3; recorder.frame(otherHost);
  const reused = udp(5000); reused.capturedAt = new Date(now + 30_000); reused.timestampTicks += 300_000_000n; recorder.frame(reused);
  const packet = [...pcapPacket(udp(5000))][0]!.packet!;
  if (attributed) {
    recorder.event("transportPacket", packet);
    recorder.event("trace", { stage: "fishnet-error", packet: { udpPacket: packet }, error: new Error("game decoder failure") });
  }
  recorder.event("trace", { stage: "attribution", ...packet, sourcePort: 7000, privateOtherApp: "must disappear" });
  recorder.stop(); return recorder.snapshot().session!;
}
function* pcapPacket(frame: ReturnType<typeof udp>) {
  const header = Buffer.alloc(40); header.writeUInt32LE(0xa1b2c3d4); header.writeUInt16LE(2, 4); header.writeUInt16LE(4, 6);
  header.writeUInt32LE(65535, 16); header.writeUInt32LE(101, 20); header.writeUInt32LE(Math.floor(now / 1000), 24); header.writeUInt32LE(123456, 28); header.writeUInt32LE(frame.data.length, 32); header.writeUInt32LE(frame.data.length, 36);
  yield* pcapPackets(Buffer.concat([header, frame.data]));
}
test("optimization removes unrelated frames/events, preserves game errors/bytes/timestamps, and is idempotent", async () => {
  const { root, recorder } = setup(), session = record(recorder), folder = join(root, "recordings", session + "_clean");
  expect(readdirSync(join(root, "recordings"))).toEqual([session]);
  const report = await maintainRecordings(root, "optimize"); expect(report).toMatchObject({ processed: 1, failed: 0 });
  expect(existsSync(join(root, "recordings", session))).toBe(false);
  const frames = [...pcapPackets(readFileSync(join(folder, "wire-1.pcap")))];
  expect(frames).toHaveLength(1); expect(frames[0]!.data).toEqual(udp(5000).data);
  expect(frames[0]!.packet?.timestampTicks).toBe(BigInt(now) * 10000n + 4560n);
  const events = readFileSync(join(folder, "events.jsonl"), "utf8");
  expect(events).toContain("game decoder failure"); expect(events).not.toContain("must disappear");
  const archive = folder + ".zip", extracted = join(root, "extracted");
  const unzip = Bun.spawnSync(["powershell.exe", "-NoProfile", "-Command", 'Expand-Archive -LiteralPath $env:MVP_TEST_ZIP -DestinationPath $env:MVP_TEST_DEST'], { env: { ...process.env, MVP_TEST_ZIP: archive, MVP_TEST_DEST: extracted }, stdout: "pipe", stderr: "pipe", windowsHide: true });
  expect(unzip.exitCode).toBe(0); expect(readFileSync(join(extracted, "wire-1.pcap"))).toEqual(readFileSync(join(folder, "wire-1.pcap")));
  expect(await maintainRecordings(root, "optimize")).toMatchObject({ processed: 0, skipped: 1, failed: 0 });
});
test("active, already zipped, unidentifiable and corrupt recordings are preserved", async () => {
  const { root, recorder } = setup();
  const zipped = record(recorder); writeFileSync(join(root, "recordings", zipped + ".zip"), "existing archive");
  const unknown = record(recorder, false), corrupt = record(recorder);
  writeFileSync(join(root, "recordings", corrupt, "wire-1.pcap"), Buffer.alloc(5));
  recorder.start(); const active = recorder.snapshot().session!;
  try {
    const report = await maintainRecordings(root, "optimize", active);
    expect(report).toMatchObject({ processed: 0, failed: 2 });
    for (const name of [active, unknown, corrupt, zipped]) expect(existsSync(join(root, "recordings", name))).toBe(true);
    expect(readFileSync(join(root, "recordings", zipped + ".zip"), "utf8")).toBe("existing archive");
    expect(readdirSync(join(root, "recordings")).some(name => name.includes(".tmp"))).toBe(false);
  } finally { recorder.stop(); }
});
test("failed ZIP retains original data and clean output; retry packages without filtering twice", async () => {
  const { root, recorder } = setup(), session = record(recorder);
  expect(await maintainRecordings(root, "optimize", undefined, async () => { throw new Error("ZIP unavailable"); })).toMatchObject({ failed: 1 });
  expect(existsSync(join(root, "recordings", session))).toBe(true);
  expect(existsSync(join(root, "recordings", session + "_clean"))).toBe(true);
  expect(await maintainRecordings(root, "optimize")).toMatchObject({ processed: 1, failed: 0 });
  expect(existsSync(join(root, "recordings", session))).toBe(false);
});
test("clear preserves an active session, unrelated files and junction targets", async () => {
  const { root, recorder } = setup(), old = record(recorder);
  writeFileSync(join(root, "recordings", old + ".zip"), "old ZIP"); writeFileSync(join(root, "recordings", "keep.txt"), "keep");
  const outside = mkdtempSync(join(tmpdir(), "mvp-recording-files-")); roots.push(outside); writeFileSync(join(outside, "keep.txt"), "outside");
  const linked = "monitor-2026-10-07T00-00-00-000Z-aabbccdd";
  symlinkSync(outside, join(root, "recordings", linked), "junction");
  recorder.start(); const active = recorder.snapshot().session!;
  try {
    expect(await maintainRecordings(root, "clear", active)).toMatchObject({ processed: 2, failed: 1 });
    expect(existsSync(join(root, "recordings", active))).toBe(true);
    expect(readFileSync(join(outside, "keep.txt"), "utf8")).toBe("outside");
    expect(readFileSync(join(root, "recordings", "keep.txt"), "utf8")).toBe("keep");
  } finally { recorder.stop(); }
});
test("the real maintenance worker returns progress and never touches its active recorder", async () => {
  const { root, recorder } = setup(); record(recorder); recorder.start();
  try {
    const work = recorder.maintain("clear");
    expect(recorder.snapshot().maintenance).toBe("clear");
    expect(() => recorder.start()).toThrow("being optimized");
    expect(await work).toMatchObject({ processed: 1, skipped: 1 });
    expect(recorder.snapshot()).toMatchObject({ active: true, maintenance: undefined });
    expect(recorder.snapshot().message).toContain("Cleared 1");
  } finally { recorder.stop(); }
});
