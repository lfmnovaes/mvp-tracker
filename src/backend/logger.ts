import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { VERSION } from "../shared/protocol";
import { LOG_EVENTS, cleanContext, type LogContext, type LogEvent } from "./log-context";
export type { LogEvent } from "./log-context";
export interface LogRecord extends LogContext { time: string; event: LogEvent; version?: string; level?: "info" | "warning" | "error" }
export class Logger {
  available = true;
  private repeats = new Map<string, { at: number; count: number }>();
  constructor(private root: string, private maxBytes = 2 * 1024 * 1024, private maxFiles = 5, private maxAge = 7 * 86400_000, private now = Date.now) {
    try { mkdirSync(root, { recursive: true }); this.prune(); } catch { this.available = false; }
  }
  private file(index: number) { return join(this.root, index === 0 ? "mvp-tracker.log" : `mvp-tracker.${index}.log`); }
  clear() {
    try { for (let i = 0; i < this.maxFiles; i++) if (existsSync(this.file(i))) unlinkSync(this.file(i)); this.repeats.clear(); this.available = true; }
    catch { throw new Error("Logs could not be cleared. Check folder access."); }
  }
  private prune() {
    for (let i = 0; i < this.maxFiles; i++) {
      const p = this.file(i);
      if (existsSync(p) && this.now() - statSync(p).mtimeMs > this.maxAge) unlinkSync(p);
    }
  }
  write(event: LogEvent, context: LogContext = {}) {
    if (!LOG_EVENTS.includes(event)) return;
    try {
      this.prune(); const at = this.now(), clean = cleanContext(context);
      const failure = /failed|unavailable|warning|rejected|fatal|timeout|exited/.test(event);
      if (failure) {
        const key = JSON.stringify([event, clean.component, clean.operation, clean.category, clean.phase]);
        const previous = this.repeats.get(key);
        if (previous && at >= previous.at && at - previous.at < 60000) { previous.count++; return; }
        if (previous?.count) clean.suppressed = previous.count;
        if (!this.repeats.has(key) && this.repeats.size >= 128) this.repeats.delete(this.repeats.keys().next().value!);
        this.repeats.set(key, { at, count: 0 });
      }
      const line = JSON.stringify({ time: new Date(at).toISOString(), event, version: VERSION, level: failure ? "error" : "info", ...clean }) + "\n";
      if (Buffer.byteLength(line) > this.maxBytes) return;
      if (existsSync(this.file(0)) && statSync(this.file(0)).size + Buffer.byteLength(line) > this.maxBytes) {
        if (existsSync(this.file(this.maxFiles - 1))) unlinkSync(this.file(this.maxFiles - 1));
        for (let i = this.maxFiles - 2; i >= 0; i--) if (existsSync(this.file(i))) renameSync(this.file(i), this.file(i + 1));
      }
      appendFileSync(this.file(0), line); this.available = true;
    } catch { this.available = false; this.repeats.clear(); }
  }
  recent(): LogRecord[] {
    const result: LogRecord[] = [];
    for (let i = 0; i < this.maxFiles && result.length < 100; i++) {
      try {
        const file = this.file(i); if (statSync(file).size > this.maxBytes) continue;
        for (const line of readFileSync(file, "utf8").trim().split("\n").reverse()) {
          try {
            const row = JSON.parse(line), age = this.now() - Date.parse(row.time);
            if (LOG_EVENTS.includes(row.event) && typeof row.time === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(row.time) && Number.isFinite(age) && age >= -30000 && age <= this.maxAge) {
              result.push({ time: row.time, event: row.event, ...cleanContext(row),
                ...(typeof row.version === "string" && /^\d{1,3}\.\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(row.version) ? { version: row.version } : {}),
                ...(["info", "warning", "error"].includes(row.level) ? { level: row.level } : {}) });
            }
          } catch { /* Damaged lines never prevent a sanitized report. */ }
          if (result.length === 100) break;
        }
      } catch { /* Missing/rotated logs are optional diagnostics. */ }
    }
    return result.reverse();
  }
}
