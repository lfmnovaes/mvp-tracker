import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PacketRecording } from "../src/backend/packet-recording";
import { PacketCapture } from "../src/spiritvale/capture/packet-capture";
import { parseRequest } from "../src/shared/protocol";
import type { NpcapPacket, NpcapRuntime } from "../src/spiritvale/capture/npcap";
const roots: string[] = [];
const now = 1791336000123;
function setup(maxBytes?: number, duration?: number) {
  const root = mkdtempSync(join(tmpdir(), "mvp-monitor-test-")); roots.push(root);
  let time = now;
  return { root, recorder: new PacketRecording(root, () => time, maxBytes, duration), advance: (ms: number) => { time += ms; } };
}
afterEach(() => { for (const root of roots.splice(0)) { if (!root.startsWith(join(tmpdir(), "mvp-monitor-test-"))) throw new Error("Unsafe cleanup"); rmSync(root, { recursive: true, force: true }); } });
const frame = (data = Buffer.from("unknown game bytes"), dataLink = 101) => ({ data, dataLink, capturedAt: new Date(now), timestampTicks: BigInt(now) * 10000n + 4560n, originalLength: data.length });
test("raw records stay off by default, preserve unknown bytes/microseconds and survive explicit Stop", async () => {
  const { root, recorder } = setup(); recorder.frame(frame()); recorder.event("secret", { name: "player" });
  expect(readdirSync(root)).toEqual([]);
  recorder.start(); const input = frame(); const bytes = Buffer.from(input.data);
  recorder.frame(input); input.data.fill(0); recorder.event("unknown-rpc", { hash: 999, payload: bytes, time: 1n }); recorder.stop();
  const folder = join(root, "recordings", recorder.snapshot().session!);
  const pcap = readFileSync(join(folder, "wire-1.pcap"));
  expect(pcap.readUInt32LE(0)).toBe(0xa1b2c3d4); expect(pcap.readUInt32LE(20)).toBe(101);
  expect(pcap.readUInt32LE(24)).toBe(Math.floor(now / 1000)); expect(pcap.readUInt32LE(28)).toBe(123456);
  expect(pcap.readUInt32LE(32)).toBe(bytes.length); expect(pcap.subarray(40)).toEqual(bytes);
  const before = pcap.length; recorder.frame(frame()); expect(readFileSync(join(folder, "wire-1.pcap")).length).toBe(before);
  expect(readFileSync(join(folder, "events.jsonl"), "utf8")).toContain("unknown-rpc");
  expect(recorder.snapshot()).toMatchObject({ active: false, frames: 1, reason: "user" });
  expect(readdirSync(join(root, "recordings")).some(name => name.endsWith(".zip"))).toBe(false);
});
test("recording limits stop cleanly, rotate link types, report malformed records and permit another session", () => {
  const { root, recorder, advance } = setup(4000, 2000); recorder.start();
  recorder.frame(frame()); recorder.frame(frame(Buffer.from("other adapter"), 1));
  recorder.frame({ ...frame(), originalLength: 0 }); expect(recorder.snapshot().rejected).toBe(1);
  advance(2000); recorder.tick({}); expect(recorder.snapshot().reason).toBe("time-limit");
  const folder = join(root, "recordings", recorder.snapshot().session!);
  expect(readdirSync(folder).filter(name => name.endsWith(".pcap"))).toHaveLength(2);
  recorder.start(); recorder.event("oversized", "x".repeat(5000)); expect(recorder.snapshot()).toMatchObject({ active: false, reason: "size-limit" });
  expect(recorder.snapshot().bytes).toBeLessThanOrEqual(4000);
});
test("the driver records unattributed, malformed and duplicate frames before all filtering, with recording disabled immediately", async () => {
  const device = { name: "test", description: "test", loopback: false, addresses: ["192.0.2.1"] };
  const packets: NpcapPacket[] = [];
  const runtime: NpcapRuntime = { status: async () => ({ availability: "ready", detail: "test" }), listDevices: async () => [device], open: async () => ({ device, dataLink: 12, nextPacket: () => packets.shift(), close: () => {} }) };
  const driver = new PacketCapture({ runtime, platform: "win32", targetProvider: { snapshot: async () => ({ processIds: [1], endpoints: [{ processId: 1, protocol: "udp", address: "0.0.0.0", port: 5000 }] }) } });
  let frames = 0, transports = 0;
  driver.on("wireFrame", () => frames++); driver.on("transportPacket", () => transports++);
  await driver.start({ protocols: ["udp", "tcp"], targetProcessName: "SpiritVale.exe", decodeFishNet: true });
  try {
    function udp(port: number) { const data = Buffer.alloc(29); data[0] = 0x45; data.writeUInt16BE(29, 2); data[9] = 17; data.set([192, 0, 2, 1], 12); data.set([192, 0, 2, 2], 16); data.writeUInt16BE(port, 20); data.writeUInt16BE(6000, 22); data.writeUInt16BE(9, 24); data[28] = 255; return frame(data); }
    driver.setDiagnostics(true); packets.push(udp(5000), udp(5000), udp(7000), frame(Buffer.from([0])));
    (driver as unknown as { poll(): void }).poll();
    expect(frames).toBe(4); expect(transports).toBe(1);
    driver.setDiagnostics(false); packets.push(udp(5000)); (driver as unknown as { poll(): void }).poll(); expect(frames).toBe(4);
  } finally { await driver.stop(); }
});
test("monitor IPC rejects arbitrary actions", () => {
  expect(parseRequest({ id: "test", method: "monitor", input: "start" })).toMatchObject({ method: "monitor", input: "start" });
  expect(() => parseRequest({ id: "test", method: "monitor", input: "inject" })).toThrow();
});
