import { extractIpPacket } from "./capture/link-layer";
import { parseTransportPacket } from "./capture/packet-parser";
/** Read our classic PCAP files without native capture or trusting packet lengths. */
export function* pcapPackets(file: Buffer) {
  if (file.length < 24 || file.readUInt32LE(0) !== 0xa1b2c3d4 || file.readUInt16LE(4) !== 2 || file.readUInt16LE(6) !== 4) throw new Error("Unsupported PCAP header.");
  const linkType = file.readUInt32LE(20), snaplen = file.readUInt32LE(16);
  let offset = 24;
  while (offset < file.length) {
    if (file.length - offset < 16) throw new Error("Interrupted PCAP record header.");
    const recordStart = offset;
    const sec = file.readUInt32LE(offset), us = file.readUInt32LE(offset + 4), length = file.readUInt32LE(offset + 8), originalLength = file.readUInt32LE(offset + 12);
    offset += 16;
    if (us >= 1_000_000 || length > snaplen || length > 65535 || length > originalLength || length > file.length - offset) throw new Error("Interrupted or invalid PCAP frame.");
    const data = file.subarray(offset, offset + length); offset += length;
    const ip = extractIpPacket(data, linkType === 101 ? 12 : linkType);
    const packet = ip && parseTransportPacket(ip, { capturedAt: new Date(sec * 1000 + Math.floor(us / 1000)), timestampTicks: BigInt(sec) * 10_000_000n + BigInt(us) * 10n, direction: "inbound", interfaceIndex: 0, loopback: linkType === 0 || linkType === 108 });
    yield { data, record: file.subarray(recordStart, offset), packet, originalLength, truncated: length < originalLength };
  }
}
