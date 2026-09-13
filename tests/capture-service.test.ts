import { expect, test } from "bun:test";
import { EventEmitter } from "node:events";
import type { CaptureConfig } from "@kar-mi/spirit-vale-tools-capture";
import { CaptureService, type CaptureLog } from "../src/backend/capture-service";
import type { CaptureRuntime } from "../src/backend/capture-runtime";
import { captureDefaults } from "../src/shared/capture";
import { defaults, parseSettings } from "../src/shared/protocol";

class Driver extends EventEmitter {
  config?: CaptureConfig;
  stops = 0;
  async start(config: CaptureConfig) { this.config = config; this.emit("targetStatus", { state: "waiting", processIds: [] }); }
  async stop() { this.stops++; this.emit("stopped"); }
}
function harness() {
  let now = 1_789_000_000_000;
  const drivers: Driver[] = [], logs: CaptureLog[] = [];
  const runtime: CaptureRuntime = {
    async probe() { return { availability: "ready", devices: [{ name: "adapter", label: "Ethernet" }], device: { name: "adapter", label: "Ethernet" } }; },
    create() { const d = new Driver(); drivers.push(d); return d; },
  };
  const service = new CaptureService(captureDefaults(), () => {}, async () => runtime, () => now, event => logs.push(event));
  const advance = (ms = 1000) => { now += ms; service.tick(); };
  return { service, runtime, drivers, logs, advance };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test("capture is process-scoped passive UDP and follows game exit without losing local timers", async () => {
  const h = harness(); await h.service.restart(); const driver = h.drivers[0]!;
  expect(driver.config).toEqual({ protocols: ["udp"], targetProcessName: "SpiritVale.exe", decodeFishNet: true, deviceName: "adapter", suppressDuplicates: true });
  expect(h.service.snapshot()).toMatchObject({ state: "running", game: "waiting", adapter: "Ethernet" });
  driver.emit("targetStatus", { state: "active", processIds: [42] });
  expect(h.service.snapshot().game).toBe("active");
  driver.emit("targetStatus", { state: "waiting", processIds: [] });
  expect(h.service.snapshot().game).toBe("waiting");
  await h.service.stop(); expect(driver.stops).toBe(1);
  h.advance(120000); await settle(); expect(h.drivers).toHaveLength(1);
});

test("the first active process notification does not erase context decoded before process discovery", async () => {
  const h = harness(); await h.service.restart(); const driver = h.drivers[0]!;
  driver.emit("fishNetPacket", { connectionId: "game", packetName: "targetRpc", rpcName: "ChannelList_T", tick: 1, raw: Buffer.from("context"),
    liteNetPacket: { packet: {}, udpPacket: { direction: "inbound", capturedAt: new Date(1_789_000_000_000) } },
    decodedFields: [{ name: "currentIndex", value: 2 }, { name: "instanceId", value: "nova-map" }] });
  expect(h.service.snapshot().channel).toBe(3);
  driver.emit("targetStatus", { state: "active", processIds: [42] }); expect(h.service.snapshot().channel).toBe(3);
  driver.emit("targetStatus", { state: "active", processIds: [43] }); expect(h.service.snapshot().channel).toBeUndefined();
  await h.service.stop();
});

test("missing Npcap retries with backoff, recovers and never claims the game is absent", async () => {
  const h = harness(); const ready = h.runtime.probe;
  h.runtime.probe = async () => ({ availability: "missing", devices: [] });
  await h.service.restart(); const state = h.service.snapshot();
  expect(state).toMatchObject({ state: "unavailable", game: "unknown" }); expect(state.detail).toContain("Npcap is missing");
  for (let i = 0; i < 4; i++) h.advance(); await settle(); expect(h.drivers).toHaveLength(0);
  h.runtime.probe = ready; h.advance(); await settle();
  expect(h.service.snapshot().state).toBe("running"); await h.service.stop();
});

test("adapter failure and runtime load failure keep errors sanitized and retries bounded", async () => {
  const h = harness(); h.runtime.probe = async () => { throw new Error("secret IP name private path"); };
  await h.service.restart(); expect(JSON.stringify(h.service.snapshot())).not.toContain("secret");
  for (let i = 0; i < 10; i++) await h.service.restart();
  expect(h.service.snapshot().retryAt).toBe(1_789_000_060_000);
  expect(h.logs.filter(e => e === "capture-unavailable")).toHaveLength(1);
  await h.service.stop();
  const broken = new CaptureService(captureDefaults(), () => {}, async () => { throw new Error("native unavailable"); });
  await broken.restart(); expect(broken.snapshot().state).toBe("unavailable"); await broken.stop();
});

test("stop wins over an in-flight start, and adapter changes serialize a single replacement", async () => {
  const h = harness(); const probe = h.runtime.probe;
  let release!: () => void;
  h.runtime.probe = async name => { await new Promise<void>(r => { release = r; }); return probe(name); };
  const pending = h.service.restart(); await settle();
  const stopped = h.service.stop(); release(); await Promise.all([pending, stopped]);
  expect(h.drivers).toHaveLength(0); expect(h.service.snapshot().state).toBe("stopped");
  h.runtime.probe = probe; await h.service.restart();
  h.service.configure({ deviceName: "other", manualCharacter: "Offline Player" }); await settle();
  expect(h.drivers).toHaveLength(2); expect(h.drivers[0]!.stops).toBe(1);
  expect(h.service.snapshot().identity).toEqual({ name: "Offline Player", source: "manual" });
  await h.service.stop();
});

test("runtime error, silent traffic and resume recover without overlapping capture", async () => {
  const h = harness(); await h.service.restart();
  h.drivers[0]!.emit("error", new Error("private native error"));
  expect(h.service.snapshot().state).toBe("unavailable");
  for (let i = 0; i < 5; i++) h.advance(); await settle(); expect(h.drivers).toHaveLength(2);
  h.drivers[1]!.emit("targetStatus", { state: "active", processIds: [42] });
  for (let i = 0; i < 91; i++) h.advance(); await settle(); expect(h.drivers).toHaveLength(3);
  h.advance(60000); await settle(); expect(h.drivers).toHaveLength(4);
  expect(h.drivers.slice(0, 3).every(d => d.stops === 1)).toBe(true); await h.service.stop();
});

test("capture settings migrate older preferences and validate identity and adapter bounds", () => {
  const old = { ...defaults(), schemaVersion: 2, capture: undefined };
  expect(parseSettings(old).capture).toEqual(captureDefaults());
  expect(parseSettings({ ...defaults(), capture: { deviceName: "", manualCharacter: " Name " } }).capture.manualCharacter).toBe("Name");
  for (const capture of [{ deviceName: "x".repeat(513), manualCharacter: "" }, { deviceName: "", manualCharacter: "name\n" }, { deviceName: "", manualCharacter: 2 }]) expect(() => parseSettings({ ...defaults(), capture })).toThrow();
});
