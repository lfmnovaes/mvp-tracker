import { decodeBossGravestone, type BossGravestone, type CapturedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";
import { FishNetCharacterTracker } from "@kar-mi/spirit-vale-tools-character";
import { regionFromInstance, type Region } from "../domain/catalog";
import { parseObservation, type Observation, type WorldPosition } from "../domain/timers";
import type { LogContext } from "./log-context";
import { CapturePositions } from "./capture-positions";

export interface CaptureContext {
  region?: Region;
  channel?: 1 | 2 | 3;
  instanceId?: string;
  character?: string;
  cachedCharacter?: string;
  unresolved: number;
}
type PendingGrave = { grave: BossGravestone; gatheredAt: number; observedByCharacter?: string; position?: WorldPosition };

// Uses the upstream grave decoder and local-player tracker. Unlike the overlay's
// object fingerprint, transport identity suppresses replays without suppressing revisits.
export class CapturePackets {
  private connection?: string;
  private closed = new Set<string>();
  private seen = new Map<string, number>();
  private pruneAt = 0;
  private character = new FishNetCharacterTracker();
  private entities = new CapturePositions();
  private context: Omit<CaptureContext, "unresolved"> = {};
  private pending = new Map<string, PendingGrave>();
  private awaitingContext = true;
  private authenticated?: string;
  private features = { coordinates: true };
  experiments() { return this.entities.stats(); }
  constructor(private readonly emit: (observation: Observation) => void,
    private readonly now = Date.now, private readonly invalid: (reason: LogContext["reason"]) => void = () => {}) {}
  configure(features: { coordinates?: boolean }) {
    const next = { coordinates: features.coordinates ?? true };
    if (next.coordinates !== this.features.coordinates) { this.entities.clear(); this.pending.clear(); }
    this.features = next;
  }

  snapshot(): CaptureContext {
    for (const [key, entry] of this.pending) if (this.now() - entry.gatheredAt > 30000) { this.pending.delete(key); this.invalid("pending-expired"); }
    return { ...this.context, unresolved: this.pending.size };
  }
  reset(clearClosed = true) {
    const cachedCharacter = this.context.character ?? this.context.cachedCharacter;
    this.character = new FishNetCharacterTracker();
    this.entities.clear();
    this.context = { cachedCharacter };
    this.connection = undefined;
    this.authenticated = undefined;
    this.seen.clear();
    this.pruneAt = 0;
    this.pending.clear(); this.awaitingContext = true;
    if (clearClosed) this.closed.clear();
  }
  connectionChanged(id: string, state: "opened" | "closed") {
    if (state === "closed") {
      this.closed.add(id);
      if (this.closed.size > 64) this.closed.delete(this.closed.values().next().value!);
      if (this.connection === id) this.reset(false);
    } else {
      this.closed.delete(id);
      // An opened transport may be unrelated traffic. Only an authenticated packet
      // can replace an established game connection (same admission rule as upstream).
    }
  }
  consume(packet: CapturedFishNetPacket) {
    const now = this.now();
    const transport = packet.liteNetPacket.udpPacket;
    if (this.closed.has(packet.connectionId)) return;
    if (this.connection && packet.connectionId !== this.connection) {
      if (packet.packetName !== "authenticated" || transport.direction !== "inbound") return;
      this.closed.add(this.connection);
      if (this.closed.size > 64) this.closed.delete(this.closed.values().next().value!);
      this.reset(false);
    }
    this.connection = packet.connectionId;
    if (packet.packetName === "disconnect") { this.connectionChanged(packet.connectionId, "closed"); return; }

    const grave = transport.direction === "inbound" && ["objectSpawn", "syncType"].includes(packet.packetName) ? decodeBossGravestone(packet) : undefined;
    const localObject = packet.objectId !== undefined && packet.objectId === this.character.currentObjectId();
    const newLocalObject = packet.packetName === "serverRpc" && transport.direction === "outbound" && packet.objectId !== undefined && !localObject;
    const relevant = grave || packet.packetName === "authenticated" || newLocalObject
      || transport.direction === "inbound" && (["objectSpawn", "objectDespawn", "syncType"].includes(packet.packetName) || packet.networkTransform)
      || localObject && (packet.packetName === "objectDespawn" || packet.networkBehaviourType === "StatusComponent")
      || packet.rpcName === "ChannelList_T" || packet.rpcName === "TraverseActive" || packet.rpcName === "QuitCharacter_Rpc";
    if (!relevant) return;
    // Tick + transport sequence + complete decoded packet bytes distinguish bundled
    // messages and reliable retransmissions. Bound memory; no packet bytes are persisted.
    const lite = packet.liteNetPacket.packet;
    const key = `${transport.direction}:${packet.tick}:${"sequence" in lite ? lite.sequence : ""}:${"channel" in lite ? lite.channel : ""}:${packet.bundleIndex ?? ""}:${Bun.hash(packet.raw)}`;
    if (now >= this.pruneAt) { for (const [id, at] of this.seen) if (now - at > 15000) this.seen.delete(id); this.pruneAt = now + 1000; }
    if (this.seen.has(key)) return;
    this.seen.set(key, now);
    while (this.seen.size > 8192) this.seen.delete(this.seen.keys().next().value!);
    if (packet.packetName === "authenticated") {
      if (this.authenticated === packet.connectionId) return;
      this.authenticated = packet.connectionId;
      const cachedCharacter = this.context.character ?? this.context.cachedCharacter;
      this.context = { cachedCharacter };
      this.character = new FishNetCharacterTracker();
      this.entities.clear();
      this.pending.clear(); this.awaitingContext = true;
      return;
    }
    if (packet.rpcName === "QuitCharacter_Rpc") {
      this.context.region = undefined; this.context.channel = undefined; this.context.instanceId = undefined;
      this.pending.clear(); this.awaitingContext = true;
      this.connectionChanged(packet.connectionId, "closed");
      return;
    }
    if (packet.rpcName === "TraverseActive" && transport.direction === "inbound") {
      // A map notification does not invalidate ChannelList_T's server/channel.
      // Discard object joins across maps, retaining only the verified connection context.
      this.entities.clear(); this.pending.clear(); return;
    }
    if (packet.rpcName === "ChannelList_T" && transport.direction === "inbound") {
      const index = packet.decodedFields?.find(f => f.name === "currentIndex")?.value;
      const instance = packet.decodedFields?.find(f => f.name === "instanceId")?.value;
      const previousInstance = this.context.instanceId, previousChannel = this.context.channel;
      this.context.channel = typeof index === "number" && Number.isInteger(index) && index >= 0 && index <= 2
        ? (index + 1) as 1 | 2 | 3 : undefined;
      this.context.instanceId = typeof instance === "string" && instance.length <= 160 ? instance : undefined;
      this.context.region = this.context.instanceId ? regionFromInstance(this.context.instanceId) : undefined;
      if (previousInstance !== undefined && (previousInstance !== this.context.instanceId || previousChannel !== this.context.channel)) { this.entities.clear(); this.pending.clear(); }
      this.awaitingContext = false;
      this.snapshot();
      for (const entry of this.pending.values()) this.record(entry, now);
      this.pending.clear();
      return;
    }
    // Only outbound server RPCs can pin the local player's object. Feed only the
    // identity SyncVars, excluding inspected-player callbacks and all stat collectors.
    if (packet.packetName === "serverRpc" && transport.direction === "outbound"
      || packet.packetName === "objectDespawn" && transport.direction === "inbound"
      || packet.packetName === "syncType" && packet.networkBehaviourType === "StatusComponent" && transport.direction === "inbound") {
      if (packet.packetName === "serverRpc" && packet.objectId !== undefined && this.character.currentObjectId() !== packet.objectId) {
        this.character = new FishNetCharacterTracker(); this.context.character = undefined;
      }
      this.character.consume(packet);
      const name = this.character.state().identity?.name;
      if (name && name.trim().length <= 80 && !/[\u0000-\u001f\u007f]/.test(name)) {
        this.context.character = name.trim(); this.context.cachedCharacter = name.trim();
      } else if (packet.packetName === "objectDespawn" && this.character.currentObjectId() === undefined) {
        this.context.character = undefined;
      }
    }
    if (transport.direction !== "inbound") return;
    const gatheredAt = transport.capturedAt.getTime();
    if (!Number.isSafeInteger(gatheredAt) || gatheredAt > now + 30000 || now - gatheredAt > 30000) { this.invalid("timestamp-invalid"); return; }
    try { this.entities.consume(packet, gatheredAt, this.features.coordinates); }
    catch { this.entities.clear(); this.invalid("experimental-rejected"); }
    if (!grave) return;
    const entry = { grave, position: this.features.coordinates ? this.entities.position(packet.objectId, gatheredAt) : undefined, gatheredAt, observedByCharacter: this.context.character };
    if ((!this.context.region || !this.context.channel) && this.awaitingContext) {
      this.snapshot();
      this.pending.set(`${packet.objectId}:${grave.mobId}`, entry);
      if (this.pending.size > 64) { this.pending.delete(this.pending.keys().next().value!); this.invalid("pending-overflow"); }
      return;
    }
    this.record(entry, now);
  }
  private record({ grave, gatheredAt, observedByCharacter, position }: PendingGrave, now: number) {
    if (!this.context.region || !this.context.channel) { this.invalid("unknown-context"); return; }
    try {
      const observation = parseObservation({
        observationId: crypto.randomUUID(), mobId: grave.mobId,
        region: this.context.region, channel: this.context.channel,
        instanceId: this.context.instanceId, diedAt: Math.round(grave.diedAtMs), killedBy: grave.killedBy || undefined,
        gatheredAt, source: "gravestone", timePrecision: "millisecond", position, observedByCharacter,
      }, now);
      this.emit(observation);
    } catch { this.invalid("observation-invalid"); }
  }
}
