import { expect, test } from "bun:test";
import type { CapturedFishNetPacket, FishNetSpawnSyncEntry } from "@kar-mi/spirit-vale-tools-capture";
import { CapturePackets } from "../src/backend/capture-packets";
import { bossById } from "../src/domain/catalog";
import type { Observation } from "../src/domain/timers";

function fixture() {
  let now = 1_789_000_000_000, tick = 0;
  const rows: Observation[] = [], capture = new CapturePackets(o => rows.push(o), () => now);
  const packet = (patch: Partial<CapturedFishNetPacket>): CapturedFishNetPacket => ({
    packetName: "syncType", tick: ++tick, packetId: 1, raw: Buffer.from(String(tick)), payload: Buffer.alloc(0), connectionId: "a",
    liteNetPacket: { packet: { property: "unreliable" }, udpPacket: { direction: "inbound", capturedAt: new Date(now) } }, ...patch,
  } as CapturedFishNetPacket);
  capture.consume(packet({ packetName: "targetRpc", rpcName: "ChannelList_T", decodedFields: [
    { name: "currentIndex", codec: "int32", value: 0 }, { name: "instanceId", codec: "stringUtf8Packed", value: "nova-map" },
  ] }));
  const entry = (name: string, value: number): FishNetSpawnSyncEntry => ({ componentIndex: 1, networkBehaviourType: "HealthComponent", index: 0, name, fields: [{ name, value, codec: "packedInt32" }] });
  const spawn = (patch: Partial<CapturedFishNetPacket> = {}, hp = 50, max = 100) => packet({ packetName: "objectSpawn", objectId: 55, ownerConnectionId: -1, spawnNested: false, spawnLocalPosition: [10, 2, 30], spawnSyncEntries: [
    { componentIndex: 0, networkBehaviourType: "MonsterController", index: 0, name: "Data", fields: [
      { name: "Id", codec: "stringUtf8Packed", value: "NightmarePaladinBoss" }, { name: "Level", codec: "packedInt32", value: bossById("NightmarePaladinBoss")!.level },
    ] }, entry("healthSync", hp), entry("maxHealthSync", max),
  ], ...patch });
  const health = (value = 50, name = "healthSync") => packet({ objectId: 55, networkBehaviourType: "HealthComponent", syncEntries: [entry(name, value)] });
  return { capture, rows, packet, spawn, health, advance: (ms = 5000) => { now += ms; } };
}

test("a server-owned catalog boss with positive health produces an Alive sighting without a fabricated kill", () => {
  const h = fixture(); h.capture.consume(h.spawn());
  expect(h.rows[0]).toMatchObject({ source: "alive", mobId: "NightmarePaladinBoss", position: { x: 10, y: 2, z: 30 } });
  expect(h.rows[0]).not.toHaveProperty("diedAt"); expect(h.rows[0]).not.toHaveProperty("killedBy");
  h.capture.consume(h.health()); expect(h.rows).toHaveLength(1);
  h.advance(); h.capture.consume(h.health()); expect(h.rows).toHaveLength(2);
  expect(h.rows[1]!.gatheredAt).toBe(h.rows[0]!.gatheredAt + 5000);
});

test("unknown, owned, nested, zero-health and inconsistent health objects never become Alive", () => {
  for (const patch of [{ ownerConnectionId: 7 }, { ownerConnectionId: undefined }, { spawnNested: true }]) {
    const h = fixture(); h.capture.consume(h.spawn(patch)); h.advance(); h.capture.consume(h.health()); expect(h.rows).toEqual([]);
  }
  const unknown = fixture(); unknown.capture.consume(unknown.spawn({ spawnSyncEntries: [] })); unknown.capture.consume(unknown.health()); expect(unknown.rows).toEqual([]);
  const wrong = fixture(), spawn = wrong.spawn(); spawn.spawnSyncEntries![0]!.fields[1]!.value = 1; wrong.capture.consume(spawn); expect(wrong.rows).toEqual([]);
  for (const hp of [0, 200, NaN]) { const f = fixture(); f.capture.consume(f.spawn({}, hp)); expect(f.rows).toEqual([]); }
});

test("late health joins either order, but transforms cannot extend stale health or revive despawned IDs", () => {
  const h = fixture(), spawn = h.spawn(); spawn.spawnSyncEntries = spawn.spawnSyncEntries!.slice(0, 1);
  h.capture.consume(spawn); h.capture.consume(h.health()); expect(h.rows).toHaveLength(0);
  h.capture.consume(h.health(100, "maxHealthSync")); expect(h.rows).toHaveLength(1);
  h.advance(); h.capture.consume(h.packet({ objectId: 55, networkTransform: { position: { x: 15 }, consumed: 1 } })); expect(h.rows).toHaveLength(1);
  h.capture.consume(h.health()); expect(h.rows[1]?.position).toEqual({ x: 15, y: 2, z: 30 });
  h.capture.consume(h.packet({ objectId: 55, packetName: "objectDespawn" })); h.advance(); h.capture.consume(h.health()); expect(h.rows).toHaveLength(2);
  h.capture.consume(h.spawn({ spawnLocalPosition: undefined })); expect(h.rows.at(-1)?.position).toBeUndefined();
});

test("positions can be missing without losing Alive, and disabling experiments prevents new evidence", () => {
  const h = fixture(); h.capture.consume(h.spawn({ spawnLocalPosition: [Infinity, 0, 0] }));
  expect(h.rows[0]?.source).toBe("alive"); expect(h.rows[0]?.position).toBeUndefined();
  h.capture.configure({ alive: false, coordinates: false }); h.advance(); h.capture.consume(h.spawn()); expect(h.rows).toHaveLength(1);
});

test("invalid health clears positive evidence before later maximum updates", () => {
  const h = fixture(), spawn = h.spawn(); spawn.spawnSyncEntries = spawn.spawnSyncEntries!.slice(0, 2);
  h.capture.consume(spawn); h.capture.consume(h.health(NaN)); h.capture.consume(h.health(100, "maxHealthSync"));
  expect(h.rows).toHaveLength(0);
  h.capture.consume(h.health()); expect(h.rows).toHaveLength(1);
  h.advance(); h.capture.consume(h.health(NaN, "maxHealthSync")); h.capture.consume(h.health()); expect(h.rows).toHaveLength(1);
});
