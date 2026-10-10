import { expect, test } from "bun:test";
import { FishNetSessionDecoder, loadBundledFishNetRpcMap, type CapturedFishNetPacket } from "../src/spiritvale";
import { CapturePackets } from "../src/backend/capture-packets";
import type { Observation } from "../src/domain/timers";

// Fabricated wire data. Encoding follows upstream bundled-rpc-map.test.ts at
// 6e075bea7e81270b5fca81a49e1e2f5bc6fde10b (AGPL-3.0-only).
function packed(value: number): Buffer {
  let unsigned = BigInt(value >= 0 ? value * 2 : -value * 2 - 1);
  const bytes: number[] = [];
  do { const byte = Number(unsigned & 0x7fn); unsigned >>= 7n; bytes.push(byte | (unsigned ? 0x80 : 0)); } while (unsigned);
  return Buffer.from(bytes);
}
function u16(n: number) { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; }
function u32(n: number) { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b; }
function f64(n: number) { const b = Buffer.alloc(8); b.writeDoubleLE(n); return b; }
function text(s: string) { const b = Buffer.from(s); return Buffer.concat([packed(b.length), b]); }
function spawn(id: number, prefab: number, sync = Buffer.alloc(0)) {
  return Buffer.concat([u16(3), Buffer.from([4]), packed(id), u16(0), packed(0), packed(-1), Buffer.from([0]), packed(prefab), u32(0), u16(0), u32(sync.length), sync]);
}

test("Public build 25647861 wire channel context decodes and assigns a real decoded grave to SA Ch3", () => {
  const now = Date.UTC(2026, 9, 6, 18), diedAt = now - 600000;
  const channelData = Buffer.concat([packed(3), packed(12), packed(23), packed(34), packed(2), text("nova-map")]);
  // Verified in the installed public GameAssembly writer: ChannelList_T now sends 38.
  const channel = Buffer.concat([u16(10), packed(7), Buffer.from([1, 0]), packed(1 + channelData.length), Buffer.from([38]), channelData]);
  const grave = spawn(55, 3, Buffer.concat([Buffer.from([0, 1, 0]), f64(diedAt / 1000), text("Synthetic Killer"), text("Echo Paladin Master"), text("NightmarePaladinBoss")]));
  const wire = Buffer.concat([u32(100), spawn(7, 4), channel, grave]);
  const decoded = new FishNetSessionDecoder(loadBundledFishNetRpcMap("6202eb64513ca6f5d338dbd44b500a3201157d99f8e7b572364e60a224654c8b")).decode(wire, { reliable: true, connectionId: "current-build" });
  expect(decoded[1]).toMatchObject({ rpcName: "ChannelList_T", rpcResolution: "verified" });
  expect(decoded[1]?.decodedFields).toEqual(expect.arrayContaining([expect.objectContaining({ name: "currentIndex", value: 2 })]));
  const rows: Observation[] = [], tracker = new CapturePackets(o => rows.push(o), () => now);
  for (const packet of decoded) tracker.consume({ ...packet, connectionId: "current-build",
    liteNetPacket: { packet: { property: "unreliable" }, udpPacket: { direction: "inbound", capturedAt: new Date(now) } },
  } as CapturedFishNetPacket);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ mobId: "NightmarePaladinBoss", region: "sa", channel: 3, diedAt, gatheredAt: now, killedBy: "Synthetic Killer", source: "gravestone" });
});

test("obsolete channel IDs never produce current server/channel context", () => {
  const data = Buffer.concat([packed(3), packed(12), packed(23), packed(34), packed(2), text("nova-map")]);
  const channel = Buffer.concat([u16(10), packed(7), Buffer.from([1, 0]), packed(1 + data.length), Buffer.from([35]), data]);
  const decoded = new FishNetSessionDecoder(loadBundledFishNetRpcMap()).decode(Buffer.concat([u32(100), spawn(7, 4), channel]), { reliable: true, connectionId: "current" });
  expect(decoded[1]?.rpcName).toBeUndefined();
  expect(decoded[1]?.decodedFields).toBeUndefined();
});

test("current and historical protocol profiles keep distinct channel IDs and immutable cached maps", () => {
  const current = loadBundledFishNetRpcMap(), legacy = loadBundledFishNetRpcMap("ce04a28c94ea82848b85c29d2867d2c9061a8972b998b30e898fcb3f65a166ba");
  const channel = (map: typeof current) => map.behaviours.find(b => b.typeName === "PlayerController")?.rpcs.find(r => r.methodName === "ChannelList_T")?.wireHash;
  const previous = loadBundledFishNetRpcMap("6202eb64513ca6f5d338dbd44b500a3201157d99f8e7b572364e60a224654c8b");
  const parameters = (map: typeof current) => map.behaviours.find(b => b.typeName === "PlayerController")?.rpcs.find(r => r.methodName === "ChannelList_T")?.parameters;
  expect(parameters(current)?.map(p => p.name)).toEqual(["playerCounts", "currentIndex", "instanceId", "pvpIndex"]);
  expect(parameters(previous)?.map(p => p.name)).toEqual(["playerCounts", "currentIndex", "instanceId"]);
  expect(channel(current)).toBe(38); expect(channel(legacy)).toBe(35); expect(loadBundledFishNetRpcMap()).toBe(current);
  expect(() => loadBundledFishNetRpcMap("unknown-build")).toThrow("unsupported");
});

test.each([-1, 0, 2])("Public build 25832491 channel payload with pvpIndex=%i produces a grave timer", pvpIndex => {
  const now = Date.UTC(2026, 9, 9, 20), diedAt = now - 600000;
  const data = Buffer.concat([packed(3), packed(12), packed(23), packed(34), packed(2), text("nova-map"), packed(pvpIndex)]);
  const channel = Buffer.concat([u16(10), packed(7), Buffer.from([1, 0]), packed(data.length + 1), Buffer.from([38]), data]);
  const grave = spawn(55, 3, Buffer.concat([Buffer.from([0, 1, 0]), f64(diedAt / 1000), text("Synthetic Killer"), text("Echo Paladin Master"), text("NightmarePaladinBoss")]));
  // Early grave must survive until the new channel context is decoded later in the same bundle.
  const wire = Buffer.concat([u32(100), spawn(7, 4), grave, channel]);
  const decoded = new FishNetSessionDecoder(loadBundledFishNetRpcMap()).decode(wire, { reliable: true, connectionId: "october-update" });
  expect(decoded[2]?.rpcName).toBe("ChannelList_T");
  expect(decoded[2]?.decodedFields).toEqual(expect.arrayContaining([expect.objectContaining({ name: "pvpIndex", value: pvpIndex })]));
  expect(decoded[2]?.undecodedPayload).toBeUndefined();
  const rows: Observation[] = [], tracker = new CapturePackets(o => rows.push(o), () => now);
  for (const packet of decoded) tracker.consume({ ...packet, connectionId: "october-update", liteNetPacket: { packet: { property: "unreliable" }, udpPacket: { direction: "inbound", capturedAt: new Date(now) } } } as CapturedFishNetPacket);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ mobId: "NightmarePaladinBoss", region: "sa", channel: 3, diedAt, gatheredAt: now, killedBy: "Synthetic Killer" });
  expect(tracker.snapshot().unresolved).toBe(0);
});

test("Public build 25832491 PlayerSave spawn consumes the new ArenaPeakRating entry", () => {
  const float = Buffer.alloc(4); float.writeFloatLE(1234.5);
  const sync = Buffer.concat([Buffer.from([7, 2, 2]), float, Buffer.from([0]), text("Synthetic Player ID")]);
  const [packet] = new FishNetSessionDecoder(loadBundledFishNetRpcMap()).decode(Buffer.concat([u32(1), spawn(7, 4, sync)]), { reliable: true, connectionId: "october-update" });
  expect(packet?.spawnSyncEntries).toMatchObject([
    { componentIndex: 7, name: "ArenaPeakRating", index: 2, fields: [{ name: "ArenaPeakRating", value: 1234.5 }] },
    { componentIndex: 7, name: "PlayerIdSync", index: 0, fields: [{ name: "PlayerIdSync", value: "Synthetic Player ID" }] },
  ]);
});

test.each(["missing", "truncated", "extra"])("new channel format rejects %s fields without guessing context", kind => {
  const now = Date.UTC(2026, 9, 9, 20), decoder = new FishNetSessionDecoder(loadBundledFishNetRpcMap());
  const prefix = Buffer.concat([packed(3), packed(12), packed(23), packed(34), packed(2), text("nova-map")]);
  const channel = (data: Buffer) => Buffer.concat([u16(10), packed(7), Buffer.from([1, 0]), packed(data.length + 1), Buffer.from([38]), data]);
  const bad = Buffer.concat([prefix, kind === "missing" ? Buffer.alloc(0) : kind === "truncated" ? Buffer.from([0x80]) : Buffer.concat([packed(-1), Buffer.from([255])])]);
  const packets = decoder.decode(Buffer.concat([u32(100), spawn(7, 4), channel(bad), spawn(55, 3, Buffer.concat([Buffer.from([0, 1, 0]), f64((now - 600000) / 1000), text("Synthetic Killer"), text("Echo Paladin Master"), text("NightmarePaladinBoss")]))]), { reliable: true, connectionId: "malformed-channel" });
  expect(packets[1]?.rpcName).toBeUndefined();
  const rows: Observation[] = [], tracker = new CapturePackets(o => rows.push(o), () => now);
  const feed = (packet: typeof packets[number]) => tracker.consume({ ...packet, connectionId: "malformed-channel", liteNetPacket: { packet: { property: "unreliable" }, udpPacket: { direction: "inbound", capturedAt: new Date(now) } } } as CapturedFishNetPacket);
  packets.forEach(feed); expect(rows).toHaveLength(0); expect(tracker.snapshot().channel).toBeUndefined();
  const [fresh] = decoder.decode(Buffer.concat([u32(101), channel(Buffer.concat([prefix, packed(-1)]))]), { reliable: true, connectionId: "malformed-channel" });
  feed(fresh!); expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ region: "sa", channel: 3 });
});
