import { expect, test } from "bun:test";
import { FishNetTransportReplay, decodeBossGravestone, FishNetSessionDecoder, loadBundledFishNetRpcMap, type CapturedFishNetPacket } from "../src/spiritvale";
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

const graveNow = Date.UTC(2026, 9, 10, 18);
function deathUpdate(id = 55, body = Buffer.concat([Buffer.from([0]), f64((graveNow - 1000) / 1000), text("Party Killer"), text("Echo Paladin Master"), text("NightmarePaladinBoss")])) {
  return Buffer.concat([u16(7), packed(id), Buffer.from([1, 0]), u32(body.length), body]);
}
function liveChannel(currentIndex: number, pvpIndex: number, count: number) {
  const body = Buffer.concat([packed(count), ...Array.from({ length: count }, () => packed(3)), packed(currentIndex), text("nova-map"), packed(pvpIndex)]);
  return Buffer.concat([u16(10), packed(7), Buffer.from([1, 0]), packed(body.length + 1), Buffer.from([38]), body]);
}
function liveHarness() {
  const rows: Observation[] = [], tracker = new CapturePackets(o => rows.push(o), () => graveNow + 1000);
  const decoder = new FishNetSessionDecoder(loadBundledFishNetRpcMap());
  const feed = (messages: Buffer, at = graveNow, connectionId = "party-kill", direction = "inbound") => {
    const packets = decoder.decode(Buffer.concat([u32(Math.floor(at / 100) >>> 0), messages]), { reliable: true, connectionId, direction, capturedAt: at });
    for (const packet of packets) tracker.consume({ ...packet, connectionId, liteNetPacket: { packet: { property: "unreliable" }, udpPacket: { direction, capturedAt: new Date(at) } } } as CapturedFishNetPacket);
    return packets;
  };
  feed(Buffer.concat([spawn(7, 4), liveChannel(0, 4, 5)]));
  return { rows, tracker, decoder, feed };
}
test.each([5, 10])("extra channel %i captures only when the server identifies it as PvP", channel => {
  const h = liveHarness();
  h.feed(liveChannel(channel - 1, channel - 1, channel));
  h.feed(Buffer.concat([spawn(55, 3), deathUpdate()]));
  expect(h.rows).toHaveLength(1);
  expect(h.rows[0]).toMatchObject({ channel, pvp: true, killedBy: "Party Killer" });
});
test.each([[3, 4, 5], [8, 9, 10], [4, -1, 5], [4, 99, 5], [9, 9, 5]])("extra non-PvP/invalid channel context is skipped (%i,%i,%i)", (index, pvp, count) => {
  const h = liveHarness(); h.feed(liveChannel(index!, pvp!, count!));
  h.feed(Buffer.concat([spawn(55, 3), deathUpdate()]));
  expect(h.rows).toHaveLength(0);
});
test("witnessed party kill: late kill info after an empty spawn is collected", () => {
  const h = liveHarness(); h.feed(spawn(55, 3)); h.feed(deathUpdate());
  expect(h.rows).toHaveLength(1); expect(h.rows[0]).toMatchObject({ killedBy: "Party Killer", diedAt: graveNow - 1000 });
});
test("witnessed party kill: update arriving before its spawn is recovered with original gathered time", () => {
  const h = liveHarness(); h.feed(deathUpdate()); expect(h.rows).toHaveLength(0);
  h.feed(spawn(55, 3), graveNow + 500);
  expect(h.rows).toHaveLength(1); expect(h.rows[0]).toMatchObject({ gatheredAt: graveNow, diedAt: graveNow - 1000 });
});
test("same-bundle update before spawn is recovered once; no payload shape guessing", () => {
  const h = liveHarness(); h.feed(Buffer.concat([deathUpdate(), spawn(55, 3)])); expect(h.rows).toHaveLength(1);
  const other = liveHarness(); other.feed(Buffer.concat([deathUpdate(), spawn(55, 4)])); expect(other.rows).toHaveLength(0);
});
test("early updates are bounded, expire, and cannot cross despawn, authentication, reset or connection", () => {
  for (const barrier of ["expiry", "despawn", "authentication", "reset", "connection", "outbound"]) {
    const h = liveHarness(); h.feed(deathUpdate(), graveNow, "party-kill", barrier === "outbound" ? "outbound" : "inbound");
    if (barrier === "despawn") h.feed(Buffer.concat([u16(4), packed(55), Buffer.from([0])]));
    if (barrier === "authentication") h.feed(Buffer.concat([u16(1), packed(1)]));
    if (barrier === "reset") h.decoder.reset();
    h.feed(spawn(55, 3), graveNow + (barrier === "expiry" ? 3000 : 500), barrier === "connection" ? "another" : "party-kill");
    expect(h.rows).toHaveLength(0);
  }
});

test("pre-spawn recovery caps pending updates and keeps only the latest per component", () => {
  const h = liveHarness(); h.feed(deathUpdate(55));
  for (let id = 100; id < 229; id++) h.feed(deathUpdate(id));
  h.feed(spawn(55, 3), graveNow + 500); expect(h.rows).toHaveLength(0);
  h.feed(deathUpdate(229)); h.feed(spawn(229, 3), graveNow + 500); expect(h.rows).toHaveLength(1);
  const latest = liveHarness(); latest.feed(deathUpdate());
  const body = Buffer.concat([Buffer.from([0]), f64((graveNow - 1000) / 1000), text("Confirmed Party Killer"), text("Echo Paladin Master"), text("NightmarePaladinBoss")]);
  latest.feed(deathUpdate(55, body), graveNow + 100); latest.feed(spawn(55, 3), graveNow + 500);
  expect(latest.rows).toHaveLength(1); expect(latest.rows[0]).toMatchObject({ killedBy: "Confirmed Party Killer", gatheredAt: graveNow + 100 });
});
test("truncated early updates cannot become observations", () => {
  const h = liveHarness(); h.feed(deathUpdate(55, Buffer.from([0, 1, 2]))); h.feed(spawn(55, 3)); expect(h.rows).toHaveLength(0);
});

test("a verified map traversal discards unresolved kill info before the next map spawn", () => {
  const h = liveHarness(); h.feed(deathUpdate());
  const data = Buffer.concat([packed(1), Buffer.from([0])]); // TraverseDto is intentionally opaque.
  const packets = h.feed(Buffer.concat([u16(10), packed(7), Buffer.from([1, 0]), packed(data.length + 1), Buffer.from([4]), data]));
  expect(packets[0]?.rpcName).toBe("TraverseActive");
  h.feed(spawn(55, 3), graveNow + 500); expect(h.rows).toHaveLength(0);
});
test("recording replay recovers reordered grave data at its recorded time, not analysis time", () => {
  const replay = new FishNetTransportReplay(), graves: { at?: number; killer?: string }[] = [];
  const feed = (messages: Buffer, at: number, direction = "inbound") => replay.consumeRecord({ type: "transport.packet", recordedAt: new Date(at).toISOString(), data: {
    protocol: "udp", sourceIP: "192.0.2.1", destinationIP: "192.0.2.2", sourcePort: 5000, destinationPort: 6000, direction,
    payloadHex: Buffer.concat([Buffer.from([0]), u32(100), messages]).toString("hex"),
  } }, (packet, observedAtMs) => { const grave = decodeBossGravestone(packet); if (grave) graves.push({ at: observedAtMs, killer: grave.killedBy }); });
  feed(deathUpdate(), graveNow); feed(spawn(55, 3), graveNow + 500);
  expect(graves).toEqual([{ at: graveNow, killer: "Party Killer" }]); expect(replay.stats().decodeWarnings).toBe(0);
});
