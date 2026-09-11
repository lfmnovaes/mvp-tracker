import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { CaptureLog } from "./capture-service";
export type LogEvent = CaptureLog | "started" | "stopped" | "storage-unavailable" | "settings-saved" | "native-unavailable" | "native-exited" | "rpc-failed" | "frontend-timeout" | "timer-storage-unavailable" | "timer-storage-restored" | "fatal";
// An allowlist, rather than regex redaction, prevents accidental sensitive payload logging.
export class Logger {
  available = true;
  constructor(private root: string, private maxBytes = 2 * 1024 * 1024, private maxFiles = 5, private maxAge = 7 * 86400_000) {
    try { mkdirSync(root, { recursive: true }); this.prune(); } catch { this.available = false; }
  }
  private file(index: number) { return join(this.root, index === 0 ? "mvp-tracker.log" : `mvp-tracker.${index}.log`); }
  private prune() {
    for (let i = 0; i < this.maxFiles; i++) {
      const p = this.file(i);
      if (existsSync(p) && Date.now() - statSync(p).mtimeMs > this.maxAge) unlinkSync(p);
    }
  }
  write(event: LogEvent) {
    try {
      this.prune();
      const line = JSON.stringify({ time: new Date().toISOString(), event }) + "\n";
      if (existsSync(this.file(0)) && statSync(this.file(0)).size + Buffer.byteLength(line) > this.maxBytes) {
        if (existsSync(this.file(this.maxFiles - 1))) unlinkSync(this.file(this.maxFiles - 1));
        for (let i = this.maxFiles - 2; i >= 0; i--) if (existsSync(this.file(i))) renameSync(this.file(i), this.file(i + 1));
      }
      appendFileSync(this.file(0), line);
    } catch { this.available = false; }
  }
  recent(): { time: string; event: string }[] {
    const allowed = new Set<string>(["started", "stopped", "storage-unavailable", "settings-saved", "native-unavailable", "native-exited", "rpc-failed", "frontend-timeout", "timer-storage-unavailable", "timer-storage-restored", "fatal", "capture-started", "capture-unavailable", "capture-recovery", "capture-warning", "capture-packet-rejected"]);
    const result: { time: string; event: string }[] = [];
    for (let i = 0; i < this.maxFiles && result.length < 100; i++) {
      try {
        const file = this.file(i); if (statSync(file).size > this.maxBytes) continue;
        for (const line of readFileSync(file, "utf8").trim().split("\n").reverse()) {
          try {
            const row = JSON.parse(line);
            if (allowed.has(row.event) && typeof row.time === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row.time)
              && Number.isFinite(Date.parse(row.time)) && Date.now() - Date.parse(row.time) <= this.maxAge) result.push({ time: row.time, event: row.event });
          } catch { /* A damaged line must not prevent a safe report. */ }
          if (result.length === 100) break;
        }
      } catch { /* Missing/rotated logs are optional diagnostics. */ }
    }
    return result.reverse();
  }
}
