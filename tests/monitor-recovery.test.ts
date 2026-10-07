import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CaptureService } from "../src/backend/capture-service";
import { PacketRecording } from "../src/backend/packet-recording";
import { parseSteamBuild } from "../src/backend/installed-game";
import { captureDefaults } from "../src/shared/capture";
import { pcapPackets } from "../src/spiritvale/pcap";

test("monitoring follows capture restart and ignores stopped/obsolete drivers", async () => {
  class Driver extends EventEmitter {
    monitoring = false;
    setDiagnostics(enabled: boolean) { this.monitoring = enabled; }
    async start() {}
    async stop() {}
  }
  const drivers: Driver[] = [], events: unknown[] = [];
  const service = new CaptureService(captureDefaults(), () => {}, async () => ({
    probe: async () => ({ availability: "ready", devices: [{ name: "test", label: "test" }], device: { name: "test", label: "test" } }),
    create: () => { const driver = new Driver(); drivers.push(driver); return driver; },
  }), Date.now, () => {}, (...event) => events.push(event));
  try {
    await service.restart(); drivers[0]!.emit("wireFrame", "off"); expect(events).toHaveLength(0);
    service.setMonitoring(true); expect(drivers[0]!.monitoring).toBe(true);
    drivers[0]!.emit("trace", { stage: "fishnet-error", error: new Error("unknown wire bytes") });
    await service.restart(); expect(drivers[1]!.monitoring).toBe(true);
    drivers[0]!.emit("wireFrame", "old"); drivers[1]!.emit("wireFrame", "new");
    const frames = () => events.filter(event => Array.isArray(event) && event[0] === "wireFrame");
    expect(frames()).toEqual([["wireFrame", "new"]]);
    service.setMonitoring(false); expect(drivers[1]!.monitoring).toBe(false);
    drivers[1]!.emit("wireFrame", "off again"); expect(frames()).toEqual([["wireFrame", "new"]]);
  } finally { await service.stop(); }
});

test("PCAP replay preserves RAW packet timestamps and rejects interrupted or oversized frames", () => {
  const root = mkdtempSync(join(tmpdir(), "mvp-pcap-test-"));
  try {
    const recording = new PacketRecording(root);
    recording.start();
    recording.event("trace", { stage: "process-endpoints", snapshot: { endpoints: [{ protocol: "udp", port: 5000 }] } });
    const data = Buffer.alloc(29);
    data[0] = 0x45; data.writeUInt16BE(29, 2); data[9] = 17;
    data.set([192, 0, 2, 1], 12); data.set([192, 0, 2, 2], 16);
    data.writeUInt16BE(5000, 20); data.writeUInt16BE(6000, 22); data.writeUInt16BE(9, 24); data[28] = 255;
    recording.frame({ data, originalLength: 29, dataLink: 12, capturedAt: new Date(), timestampTicks: 17913360001234560n });
    recording.stop(); const file = readFileSync(join(root, "recordings", recording.snapshot().session!, "wire-1.pcap"));
    const frames = [...pcapPackets(file)];
    expect(frames[0]!.packet).toMatchObject({ protocol: "udp", sourcePort: 5000, destinationPort: 6000, timestampTicks: 17913360001234560n });
    expect(() => [...pcapPackets(file.subarray(0, file.length - 1))]).toThrow();
    const oversized = Buffer.from(file); oversized.writeUInt32LE(65536, 32);
    expect(() => [...pcapPackets(oversized)]).toThrow();
    expect(() => [...pcapPackets(Buffer.alloc(23))]).toThrow();
    const analysis = Bun.spawnSync([process.execPath, "run", "analyze:recording", join(root, "recordings", recording.snapshot().session!)], { cwd: join(import.meta.dir, ".."), stdout: "pipe", stderr: "pipe", windowsHide: true });
    expect(analysis.exitCode).toBe(0);
    const result = JSON.parse(analysis.stdout.toString());
    expect(result).toMatchObject({ frames: 1, udp: 1, gameEndpointDatagrams: 1, graves: 0, replay: { datagrams: 1 } });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("storage failures stop recording without throwing into the capture loop", () => {
  const root = mkdtempSync(join(tmpdir(), "mvp-storage-test-"));
  try {
    const failures: unknown[] = [];
    const recording = new PacketRecording(root, Date.now, undefined, undefined, error => failures.push(error)); recording.start();
    // Inject a failed destination without changing Windows' open-file permissions.
    (recording as unknown as { directory: string }).directory = join(root, "missing", "session");
    expect(() => recording.frame({ data: Buffer.from([1]), originalLength: 1, dataLink: 1, capturedAt: new Date(), timestampTicks: 17913360000000000n })).not.toThrow();
    expect(recording.snapshot()).toMatchObject({ active: false, reason: "storage-error" });
    expect(failures).toHaveLength(1); expect(failures[0]).toMatchObject({ code: "ENOENT" });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("game build metadata omits Steam identity and rejects publictest", () => {
  const manifest = '"appid" "3767850" "buildid" "25647861" "installdir" "SpiritVale" "LastOwner" "private-account"';
  expect(parseSteamBuild(manifest)).toMatchObject({ branch: "public", buildId: "25647861" });
  expect(JSON.stringify(parseSteamBuild(manifest))).not.toContain("private-account");
  expect(parseSteamBuild(manifest + ' "BetaKey" "publictest"')).toEqual({ branch: "publictest", ignored: true });
  expect(parseSteamBuild('"appid" "1"')).toBeUndefined();
});
