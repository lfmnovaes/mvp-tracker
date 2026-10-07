import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PacketRecording } from "../src/backend/packet-recording";
import { pcapPackets } from "../src/spiritvale/pcap";
import { VERSION } from "../src/shared/protocol";

// Exercise the actual shipped worker and Bun, without opening the app or capturing live traffic.
const temporary = mkdtempSync(join(tmpdir(), "mvp-worker-smoke-"));
const runtime = resolve(import.meta.dir, "..", "release", `MVP-Tracker-${VERSION}-windows-x64`, "extensions");
const recorder = new PacketRecording(temporary);
try {
  const data = Buffer.alloc(29); data[0] = 0x45; data.writeUInt16BE(29, 2); data[9] = 17;
  data.set([192, 0, 2, 1], 12); data.set([192, 0, 2, 2], 16);
  data.writeUInt16BE(5000, 20); data.writeUInt16BE(6000, 22); data.writeUInt16BE(9, 24);
  const now = Date.now(); recorder.start();
  recorder.frame({ data, originalLength: data.length, dataLink: 12, capturedAt: new Date(now), timestampTicks: BigInt(now) * 10000n });
  recorder.flush(); const session = recorder.snapshot().session!;
  const folder = join(temporary, "recordings", session);
  const packet = [...pcapPackets(readFileSync(join(folder, "wire-1.pcap")))][0]!.packet!;
  recorder.event("transportPacket", packet);
  recorder.stop();
  assert.equal(existsSync(folder + ".zip"), false);
  const run = async (action: string) => {
    const child = Bun.spawn([join(runtime, "bin/bun.exe"), join(runtime, "backend/recording-worker.js"), action, temporary], { stdin: "ignore", stdout: "pipe", stderr: "pipe", windowsHide: true });
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    assert.equal(code, 0, err); return JSON.parse(out);
  };
  assert.equal((await run("optimize")).processed, 1);
  assert.equal(existsSync(folder + "_clean.zip"), true);
  assert.equal((await run("optimize")).processed, 0);
  assert.equal((await run("clear")).processed, 2);
  assert.equal(existsSync(folder + "_clean.zip"), false);
  console.log("Packaged recording worker: optimize, ZIP, retry and clear passed.");
} finally {
  recorder.stop();
  if (!temporary.startsWith(join(tmpdir(), "mvp-worker-smoke-"))) throw new Error("Unsafe test cleanup.");
  rmSync(temporary, { recursive: true, force: true });
}
