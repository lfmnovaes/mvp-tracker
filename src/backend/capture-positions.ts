import type { CapturedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";
import { parsePosition, type WorldPosition } from "../domain/timers";

interface Entity { at: number; nested: boolean; position?: WorldPosition }
// Connection/map-scoped position joins only. No monster or health tracking.
export class CapturePositions {
  private objects = new Map<number, Entity>();
  private pruneAt = 0;
  clear() { this.objects.clear(); this.pruneAt = 0; }
  stats() { return { positions: [...this.objects.values()].filter(e => e.position).length }; }
  position(id: number | undefined, at = Infinity): WorldPosition | undefined {
    const entity = id === undefined ? undefined : this.objects.get(id);
    return entity?.position && entity.at <= at ? { ...entity.position } : undefined;
  }
  consume(packet: CapturedFishNetPacket, at: number, enabled = true): void {
    const id = packet.objectId;
    if (id === undefined || !enabled) return;
    if (at >= this.pruneAt) { for (const [key, item] of this.objects) if (at - item.at > 300_000) this.objects.delete(key); this.pruneAt = at + 1000; }
    if (packet.rpcResolution === "ambiguous" || packet.rpcResolution === "unresolved") return;
    let entity = this.objects.get(id);
    if (entity && at < entity.at) return;
    if (packet.packetName === "objectDespawn") { this.objects.delete(id); return; }
    if (packet.packetName === "objectSpawn") {
      entity = { at, nested: packet.spawnNested === true };
      this.objects.delete(id); this.objects.set(id, entity);
      while (this.objects.size > 2048) this.objects.delete(this.objects.keys().next().value!);
    }
    if (!entity) return;
    entity.at = at;
    if (packet.networkTransform?.reparented) { entity.nested = true; entity.position = undefined; }
    const position = packet.spawnLocalPosition;
    if (!entity.nested && (position || packet.networkTransform)) {
      const update = packet.networkTransform?.position, old = entity.position;
      try {
        entity.position = parsePosition(position ? { x: position[0], y: position[1], z: position[2] }
          : { x: update?.x ?? old?.x, y: update?.y ?? old?.y, z: update?.z ?? old?.z });
      } catch { entity.position = undefined; }
    }
  }
}
