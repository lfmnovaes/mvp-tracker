import { expect, test } from "bun:test";
import { FishNetSessionDecoder, loadBundledFishNetRpcMap, type CapturedFishNetPacket } from "@kar-mi/spirit-vale-tools-capture";
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

test("September 21 wire channel context decodes and assigns a real decoded grave to SA Ch3", () => {
  const now = Date.UTC(2026, 8, 21, 18), diedAt = now - 600000;
  const channelData = Buffer.concat([packed(3), packed(12), packed(23), packed(34), packed(2), text("nova-map")]);
  // ChannelList_T moved from wire hash 31 to 35 in the September 21 game build.
  const channel = Buffer.concat([u16(10), packed(7), Buffer.from([1, 0]), packed(1 + channelData.length), Buffer.from([35]), channelData]);
  const grave = spawn(55, 3, Buffer.concat([Buffer.from([0, 1, 0]), f64(diedAt / 1000), text("Synthetic Killer"), text("Echo Paladin Master"), text("NightmarePaladinBoss")]));
  const wire = Buffer.concat([u32(100), spawn(7, 4), channel, grave]);
  const decoded = new FishNetSessionDecoder(loadBundledFishNetRpcMap()).decode(wire, { reliable: true, connectionId: "current-build" });
  expect(decoded[1]).toMatchObject({ rpcName: "ChannelList_T", rpcResolution: "verified" });
  expect(decoded[1]?.decodedFields).toEqual(expect.arrayContaining([expect.objectContaining({ name: "currentIndex", value: 2 })]));
  const rows: Observation[] = [], tracker = new CapturePackets(o => rows.push(o), () => now);
  for (const packet of decoded) tracker.consume({ ...packet, connectionId: "current-build",
    liteNetPacket: { packet: { property: "unreliable" }, udpPacket: { direction: "inbound", capturedAt: new Date(now) } },
  } as CapturedFishNetPacket);
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ mobId: "NightmarePaladinBoss", region: "sa", channel: 3, diedAt, gatheredAt: now, killedBy: "Synthetic Killer", source: "gravestone" });
});
