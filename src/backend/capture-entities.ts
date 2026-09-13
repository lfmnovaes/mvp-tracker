import { decodeMonsterSpawn, type CapturedFishNetPacket, type FishNetDecodedField } from "@kar-mi/spirit-vale-tools-capture";
import { bossById } from "../domain/catalog";
import { parsePosition, type WorldPosition } from "../domain/timers";

interface Entity {
  at: number; owned: boolean; nested: boolean; mobId?: string; position?: WorldPosition;
  health?: number; maximum?: number; healthAt?: number; emittedAt?: number;
}
// A bounded, connection-scoped join. No combat collectors, raw payload scanning, or player-position fallback.
export class CaptureEntities {
  private objects = new Map<number, Entity>();
  private pruneAt = 0;
  private sightings = 0;
  clear() { this.objects.clear(); this.pruneAt = 0; this.sightings = 0; }
  stats() { const rows = [...this.objects.values()]; return { bossObjects: rows.filter(e => e.mobId && !e.owned && !e.nested).length, positions: rows.filter(e => e.position).length, sightings: this.sightings }; }
  position(id: number | undefined, at = Infinity): WorldPosition | undefined { const entity = id === undefined ? undefined : this.objects.get(id); const p = entity && entity.at <= at ? entity.position : undefined; return p && { ...p }; }
  consume(packet: CapturedFishNetPacket, at: number, features: { coordinates?: boolean; alive?: boolean } = {}): string | undefined {
    const id = packet.objectId;
    if (id === undefined) return;
    if (at >= this.pruneAt) { for (const [key, item] of this.objects) if (at - item.at > 300_000) this.objects.delete(key); this.pruneAt = at + 1000; }
    if (packet.rpcResolution === "ambiguous" || packet.rpcResolution === "unresolved") return;
    let entity = this.objects.get(id);
    if (entity && at < entity.at) return;
    if (packet.packetName === "objectDespawn") { this.objects.delete(id); return; }
    if (packet.packetName === "objectSpawn") {
      entity = { at, owned: packet.ownerConnectionId !== -1, nested: packet.spawnNested === true };
      const mob = decodeMonsterSpawn(packet, { get: bossById });
      if (mob && mob.level === bossById(mob.mobId)?.level) entity.mobId = mob.mobId;
      this.objects.delete(id); this.objects.set(id, entity);
      while (this.objects.size > 2048) this.objects.delete(this.objects.keys().next().value!);
    }
    if (!entity) return; // A health update without an ownership/position baseline is not enough.
    entity.at = at;
    if (packet.networkTransform?.reparented) { entity.nested = true; entity.position = undefined; }
    const position = packet.spawnLocalPosition;
    if (features.coordinates !== false && !entity.nested && (position || packet.networkTransform)) {
      const update = packet.networkTransform?.position, old = entity.position;
      try {
        entity.position = parsePosition(position ? { x: position[0], y: position[1], z: position[2] }
          : { x: update?.x ?? old?.x, y: update?.y ?? old?.y, z: update?.z ?? old?.z });
      } catch { entity.position = undefined; }
    }
    if (packet.packetName === "syncType" && packet.networkBehaviourType === "MonsterController") {
      const fields = packet.decodedFields ?? packet.syncEntries?.flatMap(e => e.fields) ?? [];
      const value = (name: string) => fields.find(f => [name, `Data.${name}`, `Monster.${name}`].includes(f.name))?.value;
      const mob = value("Id"), level = value("Level");
      if (typeof mob === "string" && level === bossById(mob)?.level && bossById(mob)) entity.mobId = mob;
      else if (mob !== undefined) entity.mobId = undefined;
    }
    let healthChanged = false;
    const read = (name: string, fields: readonly FishNetDecodedField[]) => {
      if (name !== "healthSync" && name !== "maxHealthSync") return;
      const value = fields.find(f => f.name === name || f.name === "value")?.value;
      if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647) {
        if (name === "healthSync") { entity!.health = undefined; entity!.healthAt = undefined; }
        else entity!.maximum = undefined;
        return;
      }
      if (name === "healthSync") { entity!.health = value; entity!.healthAt = at; healthChanged = true; }
      if (name === "maxHealthSync") { entity!.maximum = value; healthChanged = true; }
    };
    for (const entry of packet.spawnSyncEntries ?? []) if (entry.networkBehaviourType === "HealthComponent") read(entry.name, entry.fields);
    if (packet.networkBehaviourType === "HealthComponent") {
      for (const entry of packet.syncEntries ?? []) read(entry.name, entry.fields);
      for (const name of ["healthSync", "maxHealthSync"]) if (packet.decodedFields?.some(f => f.name === name)) read(name, packet.decodedFields);
    }
    const identityChanged = packet.packetName === "objectSpawn" || packet.networkBehaviourType === "MonsterController";
    if (features.alive === false || entity.owned || entity.nested || !entity.mobId || !entity.health || !entity.maximum || entity.health > entity.maximum
      || entity.healthAt === undefined || at - entity.healthAt > 2000 || !healthChanged && !identityChanged) return;
    if (entity.emittedAt !== undefined && at - entity.emittedAt < 5000) return;
    entity.emittedAt = at; this.sightings = Math.min(999999, this.sightings + 1); return entity.mobId;
  }
}
