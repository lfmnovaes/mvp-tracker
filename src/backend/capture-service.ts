import type { CapturedFishNetPacket, CaptureTargetStatus, CaptureConnectionEvent } from "@kar-mi/spirit-vale-tools-capture";
import { CapturePackets } from "./capture-packets";
import type { CaptureRuntime, CaptureDriver } from "./capture-runtime";
import { emptyCapture, type CaptureSettings, type CaptureSnapshot } from "../shared/capture";
import type { Observation } from "../domain/timers";

export type CaptureLog = "capture-started" | "capture-unavailable" | "capture-recovery" | "capture-warning" | "capture-packet-rejected";
// One lifecycle operation at a time. Runtime is lazy-loaded so an unsupported
// native dependency leaves the shell and local timer functionality available.
export class CaptureService {
  private state = emptyCapture();
  private packets: CapturePackets;
  private driver?: CaptureDriver;
  private wanted = false;
  private generation = 0;
  private busy?: Promise<void>;
  private retryDelay = 5000;
  private lastTick: number;
  private activeSince?: number;
  private processKey = "";
  private lastRecovery = 0;
  private logTimes = new Map<CaptureLog, number>();
  constructor(private settings: CaptureSettings,
    emit: (o: Observation) => void,
    private readonly loadRuntime: () => Promise<CaptureRuntime> = async () => (await import("./capture-runtime")).runtime,
    private readonly now = Date.now,
    private readonly log: (event: CaptureLog) => void = () => {}) {
    this.lastTick = now();
    this.packets = new CapturePackets(emit, now, () => {
      this.state.skipped = Math.min(999999, this.state.skipped + 1); this.report("capture-packet-rejected");
    });
  }
  snapshot(): CaptureSnapshot {
    const context = this.packets.snapshot();
    return { ...this.state, devices: this.state.devices.map(d => ({ ...d })),
      region: context.region, channel: context.channel, character: context.character, cachedCharacter: context.cachedCharacter, unresolved: context.unresolved,
      identity: context.character ? { name: context.character, source: "live" }
        : context.cachedCharacter ? { name: context.cachedCharacter, source: "cached" }
        : this.settings.manualCharacter ? { name: this.settings.manualCharacter, source: "manual" } : { source: "unavailable" } };
  }
  configure(settings: CaptureSettings) {
    const changed = this.settings.deviceName !== settings.deviceName;
    this.settings = settings;
    if (changed) void this.restart();
  }
  private report(event: CaptureLog) {
    const now = this.now(), previous = this.logTimes.get(event);
    if (previous !== undefined && now - previous < 60_000) return;
    this.logTimes.set(event, now); this.log(event);
  }
  restart(): Promise<void> {
    this.wanted = true; this.generation++; this.state.retryAt = undefined;
    return this.reconcile();
  }
  async stop(): Promise<void> {
    this.wanted = false; this.generation++; this.state.retryAt = undefined;
    await this.reconcile();
  }
  private reconcile(): Promise<void> {
    if (this.busy) return this.busy;
    this.busy = this.run().finally(() => { this.busy = undefined; });
    return this.busy;
  }
  private async run() {
    let token: number;
    do {
      token = this.generation;
      const old = this.driver; this.driver = undefined;
      try { await old?.stop(); } catch { this.report("capture-warning"); }
      this.packets.reset(); this.activeSince = undefined; this.processKey = "";
      this.state.lastPacketAt = undefined; this.state.game = "unknown";
      if (!this.wanted) { this.state.state = "stopped"; this.state.detail = "Capture stopped."; continue; }
      this.state.state = "starting"; this.state.detail = "Checking Npcap and network adapters…";
      try {
        const runtime = await this.loadRuntime();
        const probe = await runtime.probe(this.settings.deviceName);
        if (token !== this.generation) continue;
        this.state.devices = probe.devices; this.state.adapter = probe.device?.label;
        if (probe.availability !== "ready") {
          this.failed(probe.availability === "missing" ? "Npcap is missing. Install Npcap with WinPcap API-compatible mode, then Retry capture."
            : "Npcap could not be opened. Check its installation and access permissions, then Retry capture."); continue;
        }
        if (!probe.device) { this.failed("No capture adapter is available. Connect to a network, then Retry capture."); continue; }
        const driver = runtime.create(); this.driver = driver;
        const current = () => this.wanted && token === this.generation && this.driver === driver;
        driver.on("targetStatus", (status: CaptureTargetStatus) => {
          if (!current()) return;
          const processKey = status.processIds.slice().sort((a, b) => a - b).join(",");
          if (this.state.game !== status.state || this.processKey !== processKey) {
            this.packets.reset(); this.state.lastPacketAt = undefined;
            this.activeSince = status.state === "active" ? this.now() : undefined;
          }
          this.state.game = status.state; this.processKey = processKey;
        });
        driver.on("connection", (event: CaptureConnectionEvent) => { if (current()) this.packets.connectionChanged(event.connectionId, event.state); });
        driver.on("fishNetPacket", (packet: CapturedFishNetPacket) => {
          if (!current()) return;
          this.state.lastPacketAt = this.now(); this.retryDelay = 5000;
          try { this.packets.consume(packet); } catch { this.report("capture-packet-rejected"); }
        });
        driver.on("warning", () => { if (current()) { this.state.detail = "Capture reported a warning. If timers do not update, select another adapter or Retry capture."; this.report("capture-warning"); } });
        driver.on("error", () => { if (current()) { this.driver = undefined; this.failed("Capture failed. Retrying automatically; check Npcap and the selected adapter."); void driver.stop().catch(() => {}); } });
        driver.on("stopped", () => { if (current()) { this.driver = undefined; this.failed("Capture stopped unexpectedly. Retrying automatically."); } });
        await driver.start({ protocols: ["udp"], targetProcessName: "SpiritVale.exe", decodeFishNet: true, deviceName: probe.device.name, suppressDuplicates: true });
        if (token !== this.generation || this.driver !== driver) continue;
        this.state.state = "running"; this.state.retryAt = undefined;
        this.state.detail = probe.fallback ? "Saved adapter unavailable; using the automatic adapter." : "Passive capture ready. Walk near a gravestone to collect a timer.";
        this.report("capture-started");
      } catch {
        const failedDriver = this.driver; this.driver = undefined;
        try { await failedDriver?.stop(); } catch { /* Keep the shell usable if native cleanup fails. */ }
        if (token === this.generation) this.failed("Capture could not start. Check Npcap installation and adapter permissions. Retrying automatically.");
      }
    } while (token !== this.generation);
  }
  private failed(detail: string) {
    this.state.state = "unavailable"; this.state.game = "unknown"; this.state.detail = detail;
    this.packets.reset(); this.state.lastPacketAt = undefined;
    this.state.retryAt = this.now() + this.retryDelay;
    this.retryDelay = Math.min(60000, this.retryDelay * 2); this.report("capture-unavailable");
  }
  // Called by the backend's existing 1-second maintenance timer, including in tray.
  tick() {
    const now = this.now(), gap = now - this.lastTick; this.lastTick = now;
    if (!this.wanted || this.busy) return;
    if (gap > 15000 || gap < 0) { this.report("capture-recovery"); void this.restart(); return; }
    if (this.state.retryAt !== undefined && now >= this.state.retryAt) { void this.restart(); return; }
    const last = this.state.lastPacketAt ?? this.activeSince;
    if (this.state.state === "running" && this.state.game === "active" && last !== undefined && now - last > 90000) {
      this.state.detail = "Game detected, but no recent decoded packets. Check the adapter or change maps; capture will retry.";
      if (now - this.lastRecovery > 90000) { this.lastRecovery = now; this.report("capture-recovery"); void this.restart(); }
    }
  }
}
