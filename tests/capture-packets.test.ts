import { expect, test } from "bun:test";
import type { CapturedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";
import { CapturePackets } from "../src/backend/capture-packets";
import type { Observation } from "../src/domain/timers";

// Synthetic decoded envelopes: no real traffic or player data is recorded.
function harness() {
  let now = 1_789_000_000_000, tick = 1;
  const observations: Observation[] = [];
  const decoder = new CapturePackets(o => observations.push(o), () => now);
  const packet = (overrides: Partial<CapturedFishNetPacket> = {}, outbound = false): CapturedFishNetPacket => ({
    tick: tick++, packetId: 1, packetName: "syncType", raw: Buffer.from(String(tick)), payload: Buffer.alloc(0), connectionId: "session-a",
    liteNetPacket: {
      mergePath: [], packet: { propertyId: 0, property: "unreliable", connectionNumber: 0, fragmented: false, raw: Buffer.alloc(0), payload: Buffer.alloc(0) },
      udpPacket: { protocol: "udp", timestampTicks: 0n, capturedAt: new Date(now), interfaceIndex: 1, subinterfaceIndex: 0, direction: outbound ? "outbound" : "inbound", loopback: false, ipVersion: 4, sourceIP: "192.0.2.1", destinationIP: "192.0.2.2", sourcePort: 1, destinationPort: 2, truncated: false, payload: Buffer.alloc(0) },
    }, ...overrides,
  });
  const context = (instance = "nova-map", currentIndex = 0) => decoder.consume(packet({ packetName: "targetRpc", rpcName: "ChannelList_T", decodedFields: [
    { name: "instanceId", codec: "stringUtf8Packed" as const, value: instance }, { name: "currentIndex", codec: "int32" as const, value: currentIndex },
  ] }));
  const killedAt = now - 600_000;
  const grave = (spawn = false) => {
    const fields = [
      { name: "KillTime", codec: "float64" as const, value: killedAt / 1000 },
      { name: "BossId", codec: "stringUtf8Packed" as const, value: "NightmarePaladinBoss" },
      { name: "BossName", codec: "stringUtf8Packed" as const, value: "Echo Paladin Master" },
      { name: "KillerName", codec: "stringUtf8Packed" as const, value: "Example Killer" },
    ];
    return packet({ objectId: 55, packetName: spawn ? "objectSpawn" : "syncType", networkBehaviourType: "BossGraveStone",
      ...(spawn ? { spawnSyncEntries: [{ index: 0, name: "Data", componentIndex: 0, networkBehaviourType: "BossGraveStone", fields }] } : { decodedFields: fields }) });
  };
  return { decoder, observations, packet, context, grave, advance: () => { now += 1000; } };
}

test("grave spawn and fresh SyncType preserve killer and ignore retransmissions", () => {
  const h = harness(); h.context(); const spawn = h.grave(true);
  h.decoder.consume(spawn); h.advance(); h.decoder.consume(spawn);
  expect(h.observations).toHaveLength(1);
  expect(h.observations[0]).toMatchObject({ region: "sa", channel: 1, killedBy: "Example Killer", source: "gravestone" });
  const revisit = h.grave(true); h.decoder.consume(revisit);
  expect(h.observations[1]!.gatheredAt).toBeGreaterThan(h.observations[0]!.gatheredAt);
  expect(h.observations[1]!.diedAt).toBe(h.observations[0]!.diedAt);
  h.decoder.consume(h.grave()); expect(h.observations).toHaveLength(3);
});

test("missing or invalid slot context is never guessed, and closed connections cannot replay", () => {
  const h = harness(); h.decoder.consume(h.grave());
  h.context("unrecognized-map"); h.decoder.consume(h.grave());
  h.context("sun-map", 3); h.decoder.consume(h.grave());
  expect(h.observations).toHaveLength(0);
  h.context("sun-map", 2); h.decoder.consume(h.grave());
  expect(h.observations[0]).toMatchObject({ region: "na", channel: 3 });
  h.decoder.connectionChanged("session-a", "closed"); h.context(); h.decoder.consume(h.grave());
  expect(h.observations).toHaveLength(1);
});

test("only the outbound-pinned local object supplies observer identity", () => {
  const h = harness(); h.context();
  h.decoder.consume(h.packet({ packetName: "serverRpc", objectId: 7 }, true));
  const identity = (objectId: number, name: string) => h.packet({ objectId, networkBehaviourType: "StatusComponent", decodedFields: [{ name: "DisplayName", codec: "stringUtf8Packed" as const, value: name }] });
  h.decoder.consume(identity(8, "Inspected Player"));
  expect(h.decoder.snapshot().character).toBeUndefined();
  h.decoder.consume(identity(7, "Local Player")); h.decoder.consume(h.grave());
  expect(h.observations[0]!.observedByCharacter).toBe("Local Player");
  h.decoder.consume(h.packet({ packetName: "serverRpc", objectId: 9 }, true));
  expect(h.decoder.snapshot().character).toBeUndefined();
  h.decoder.consume(identity(9, "New Character"));
  expect(h.decoder.snapshot().character).toBe("New Character");
  h.decoder.reset(); expect(h.decoder.snapshot()).toEqual({ cachedCharacter: "New Character", unresolved: 0 });
});

test("map notifications preserve channel context; authenticated transfers and quit invalidate it", () => {
  const h = harness(); const auth = h.packet({ packetName: "authenticated" }); h.decoder.consume(auth);
  h.context(); h.decoder.consume(auth); h.decoder.consume(h.packet({ packetName: "authenticated" }));
  h.decoder.consume(h.grave()); expect(h.observations).toHaveLength(1);
  h.decoder.consume(h.packet({ packetName: "targetRpc", rpcName: "TraverseActive" }));
  h.decoder.consume(h.grave()); expect(h.observations).toHaveLength(2);
  expect(h.observations[1]).toMatchObject({ region: "sa", channel: 1 });
  h.context("sun-map", 1); h.decoder.consume(h.grave()); expect(h.observations[2]).toMatchObject({ region: "na", channel: 2 });
  h.decoder.consume(h.packet({ packetName: "serverRpc", rpcName: "QuitCharacter_Rpc" }, true));
  h.context(); h.decoder.consume(h.grave()); expect(h.observations).toHaveLength(3);
});

test("early graves resolve only within a bounded connection context and retain original capture time", () => {
  const h = harness(); const grave = h.grave(); h.decoder.consume(grave);
  expect(h.decoder.snapshot().unresolved).toBe(1); expect(h.observations).toHaveLength(0);
  h.advance(); h.context();
  expect(h.observations[0]!.gatheredAt).toBe(grave.liteNetPacket.udpPacket.capturedAt.getTime());
  h.decoder.reset(); h.decoder.consume(h.grave());
  for (let i = 0; i < 31; i++) h.advance(); h.context(); expect(h.observations).toHaveLength(1);
  h.decoder.reset(); h.decoder.consume(h.grave()); h.decoder.connectionChanged("session-b", "opened");
  expect(h.decoder.snapshot().unresolved).toBe(1);
  h.decoder.consume(h.packet({ packetName: "authenticated", connectionId: "session-b" }));
  expect(h.decoder.snapshot().unresolved).toBe(0);
});

test("unrelated opened connections cannot steal the active game session", () => {
  const h = harness(); h.context();
  h.decoder.connectionChanged("other-transport", "opened");
  h.decoder.consume(h.packet({ connectionId: "other-transport", packetName: "objectSpawn" }));
  h.decoder.consume(h.grave()); expect(h.observations).toHaveLength(1);
  expect(h.observations[0]).toMatchObject({ region: "sa", channel: 1 });
  h.decoder.consume(h.packet({ connectionId: "other-transport", packetName: "authenticated" }));
  h.decoder.consume(h.grave()); expect(h.observations).toHaveLength(1);
  expect(h.decoder.snapshot().channel).toBeUndefined();
});

test("late initial context joins within 30 seconds without restamping a grave", () => {
  const h = harness(); const grave = h.grave(); h.decoder.consume(grave);
  for (let i = 0; i < 20; i++) h.advance(); h.context();
  expect(h.observations[0]?.gatheredAt).toBe(grave.liteNetPacket.udpPacket.capturedAt.getTime());
});

test("transport replay identities expire so a later fresh capture is not suppressed indefinitely", () => {
  const h = harness(); h.context(); const grave = h.grave(); h.decoder.consume(grave);
  for (let i = 0; i < 16; i++) h.advance();
  grave.liteNetPacket.udpPacket.capturedAt = h.grave().liteNetPacket.udpPacket.capturedAt;
  h.decoder.consume(grave); expect(h.observations).toHaveLength(2);
  expect(h.observations[1]!.gatheredAt - h.observations[0]!.gatheredAt).toBe(16000);
});

test("fresh marker positions join from its empty spawn; bad, nested and reused positions stay absent", () => {
  const h = harness(); h.context();
  h.decoder.consume(h.packet({ packetName: "objectSpawn", objectId: 55, spawnLocalPosition: [12.5, 3, -40] }));
  h.decoder.consume(h.grave()); expect(h.observations[0]?.position).toEqual({ x: 12.5, y: 3, z: -40 });
  for (const patch of [{ spawnNested: true, spawnLocalPosition: [1, 2, 3] as const }, { spawnLocalPosition: [Infinity, 2, 3] as const }, {}]) {
    h.advance(); h.decoder.consume(h.packet({ packetName: "objectSpawn", objectId: 55, ...patch }));
    h.decoder.consume(h.grave()); expect(h.observations.at(-1)?.position).toBeUndefined();
  }
  h.decoder.configure({ coordinates: false }); h.advance(); h.decoder.consume({ ...h.grave(true), spawnLocalPosition: [1, 2, 3] });
  expect(h.observations.at(-1)?.position).toBeUndefined();
});

test("late grave packets cannot borrow a newer object's position", () => {
  const h = harness(); h.context(); const older = h.grave(); h.advance();
  h.decoder.consume(h.packet({ packetName: "objectSpawn", objectId: 55, spawnLocalPosition: [1, 2, 3] }));
  h.decoder.consume(older); expect(h.observations[0]?.position).toBeUndefined();
  h.decoder.consume(h.grave()); expect(h.observations[1]?.position).toEqual({ x: 1, y: 2, z: 3 });
  h.decoder.consume(h.packet({ packetName: "authenticated" })); h.context(); h.decoder.consume(h.grave());
  expect(h.observations[2]?.position).toBeUndefined();
});

test("partial transforms use a known baseline and despawn/reparenting invalidate positions", () => {
  const h = harness(); h.context();
  h.decoder.consume(h.packet({ packetName: "objectSpawn", objectId: 55, spawnLocalPosition: [1, 2, 3] }));
  h.advance(); h.decoder.consume(h.packet({ objectId: 55, networkTransform: { position: { x: 8 }, consumed: 1 } }));
  h.decoder.consume(h.grave()); expect(h.observations.at(-1)?.position).toEqual({ x: 8, y: 2, z: 3 });
  h.decoder.consume(h.packet({ objectId: 55, networkTransform: { position: {}, reparented: true, consumed: 1 } }));
  h.decoder.consume(h.grave()); expect(h.observations.at(-1)?.position).toBeUndefined();
  h.decoder.consume(h.packet({ packetName: "objectDespawn", objectId: 55 }));
  h.decoder.consume(h.packet({ objectId: 55, networkTransform: { position: { x: 9, y: 9, z: 9 }, consumed: 1 } }));
  h.decoder.consume(h.grave()); expect(h.observations.at(-1)?.position).toBeUndefined();
});

test("malformed experimental spawn data cannot suppress a valid grave", () => {
  const h = harness(); h.context(); const grave = h.grave(true);
  grave.spawnSyncEntries!.push({ componentIndex: 1, networkBehaviourType: "MonsterController", name: "Data", index: 0, fields: undefined as never });
  h.decoder.consume(grave); expect(h.observations[0]?.source).toBe("gravestone");
  expect(h.observations[0]?.killedBy).toBe("Example Killer");
});
