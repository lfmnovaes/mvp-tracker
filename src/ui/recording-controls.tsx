import { useEffect, useRef, useState } from "preact/hooks";
import type { MonitorStatus } from "../shared/monitor";
export type MonitorAction = "start" | "stop" | "open" | "optimize" | "clear";
export function RecordingControls({ connected, status, now, onAction, onMessage }: { connected: boolean; status?: MonitorStatus; now: number; onAction: (action: MonitorAction) => Promise<void>; onMessage: (message: string) => void }) {
  const jobs = useRef(new Set<MonitorAction>()), [busy, setBusy] = useState(new Set<MonitorAction>());
  const lastMessage = useRef(status?.message);
  useEffect(() => {
    if (status?.message && status.message !== lastMessage.current) onMessage(status.message);
    lastMessage.current = status?.message;
  }, [status?.message]);
  const maintainBusy = !!status?.maintenance || busy.has("optimize") || busy.has("clear");
  const run = async (action: MonitorAction) => {
    if (jobs.current.has(action)) return;
    jobs.current.add(action); setBusy(new Set(jobs.current));
    try { await onAction(action); } catch (error) { onMessage((error as Error).message); }
    finally { jobs.current.delete(action); setBusy(new Set(jobs.current)); }
  };
  return <>
    <h3>Monitor all packets</h3>
    <p class="help">Raw TCP/UDP on the selected adapter, decoder errors and capture health. Stops at 10 minutes or 128 MiB. Stop leaves a folder; Optimize keeps attributed Spirit Vale traffic and creates a _clean ZIP. Existing ZIPs are skipped. Raw recordings include other apps’ traffic. Nothing is uploaded.</p>
    <div class="diagnostic-actions">
      <button disabled={!connected || busy.has("start") || busy.has("stop") || !status?.active && maintainBusy} onClick={() => void run(status?.active ? "stop" : "start")}>{busy.has("start") || busy.has("stop") ? "Working…" : status?.active ? "Stop recording" : "Start monitor all"}</button>
      <button disabled={!connected || maintainBusy} onClick={() => void run("optimize")}>{maintainBusy && (status?.maintenance === "optimize" || busy.has("optimize")) ? "Optimizing…" : "Optimize all recordings"}</button>
      <button class="exit" disabled={!connected || maintainBusy} onClick={() => { if (window.confirm("Delete all stopped recording folders and ZIPs? The active recording will be kept.")) void run("clear"); }}>{maintainBusy && (status?.maintenance === "clear" || busy.has("clear")) ? "Clearing…" : "Clear recordings"}</button>
      <button disabled={!connected || busy.has("open")} onClick={() => void run("open")}>Open recordings</button>
    </div>
    {status?.session && <p class="help" role="status">{status.active ? `Recording · ${Math.max(0, Math.ceil((status.until - now) / 1000))}s remaining` : "Stopped"} · {status.frames} frames · {(status.bytes / 1048576).toFixed(1)} MiB{status.reason ? ` · ${status.reason}` : ""}{status.rejected ? ` · ${status.rejected} rejected` : ""}</p>}
    {status?.active && status.frames === 0 && <p class="help">Waiting for raw frames. Check Capture status and the selected adapter if this stays at zero.</p>}
    {status?.message && <p class="help">{status.message}</p>}
  </>;
}
