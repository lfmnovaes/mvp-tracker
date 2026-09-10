import { PacketCapture, getNpcapStatus, listNpcapDevices, resolveCaptureDevice } from "@kar-mi/spirit-vale-tools-capture/capture";
import type { CaptureConfig } from "@kar-mi/spirit-vale-tools-capture";
export interface CaptureDriver {
  on(event: string, listener: (...args: any[]) => void): unknown;
  start(config: CaptureConfig): Promise<void>;
  stop(): Promise<void>;
}
export interface CaptureRuntime {
  probe(deviceName: string): Promise<{ availability: "ready" | "missing" | "error"; devices: { name: string; label: string }[]; device?: { name: string; label: string }; fallback?: boolean }>;
  create(): CaptureDriver;
}
export const runtime: CaptureRuntime = {
  async probe(deviceName) {
    const status = await getNpcapStatus();
    if (status.availability !== "ready") return { availability: status.availability, devices: [] };
    const devices = await listNpcapDevices();
    const chosen = await resolveCaptureDevice(devices, deviceName || undefined);
    const label = (d: typeof devices[number]) => ({ name: d.name, label: d.description || d.name });
    return { availability: "ready", devices: devices.map(label), device: chosen.device ? label(chosen.device) : undefined, fallback: chosen.usedFallback };
  },
  create: () => new PacketCapture(),
};
