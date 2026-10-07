import type { CapturedFishNetPacket } from "./fishnet/types";

/** Identity only: bind an outbound local object, then accept its inbound name. */
export class CharacterIdentity {
  private objectId?: number;
  private connectionId?: string;
  private name?: string;
  currentObjectId() { return this.objectId; }
  state() { return { identity: this.name ? { name: this.name } : undefined }; }
  consume(packet: CapturedFishNetPacket) {
    const direction = packet.liteNetPacket.udpPacket.direction;
    if (packet.packetName === "serverRpc" && direction === "outbound" && packet.objectId !== undefined) {
      if (this.objectId !== packet.objectId || this.connectionId !== packet.connectionId) this.name = undefined;
      this.objectId = packet.objectId; this.connectionId = packet.connectionId;
    } else if (packet.connectionId === this.connectionId) {
      if (packet.packetName === "authenticated" || packet.packetName === "disconnect"
        || packet.packetName === "objectDespawn" && packet.objectId === this.objectId) {
        this.objectId = undefined; this.connectionId = undefined; this.name = undefined;
      } else if (direction === "inbound" && packet.packetName === "syncType" && packet.objectId === this.objectId
        && packet.networkBehaviourType === "StatusComponent") {
        const name = packet.decodedFields?.find(f => f.name === "DisplayName")?.value;
        if (typeof name === "string" && name.trim().length > 0 && name.trim().length <= 80 && !/[\u0000-\u001f\u007f]/.test(name)) this.name = name.trim();
      }
    }
  }
}
