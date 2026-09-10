import { appendFileSync, existsSync, mkdirSync, renameSync, statSync, unlinkSync } from "node:fs";
import { join } from "node:path";
export type LogEvent = "started" | "stopped" | "storage-unavailable" | "settings-saved" | "native-unavailable" | "native-exited" | "rpc-failed" | "frontend-timeout" | "fatal";
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
}
