export const LOG_EVENTS = ["started", "stopped", "storage-unavailable", "settings-saved", "native-unavailable", "native-exited", "rpc-failed", "frontend-timeout", "timer-storage-unavailable", "timer-storage-restored", "fatal", "capture-started", "capture-unavailable", "capture-recovery", "capture-warning", "capture-packet-rejected", "sharing-request", "sharing-failed", "sync-completed", "sync-failed", "connection-saved", "logs-opened"] as const;
export type LogEvent = typeof LOG_EVENTS[number];
const operations = ["capture", "persist", "uncaughtException", "unhandledRejection", "test", "initialize", "snapshot", "sync", "reset", "prune", "configure", "saveSettings", "sharingSave", "sharingRead", "sharingTest", "sharingReset", "syncControl", "syncInterval", "pruneOutdated", "removeTimer", "exportTimers", "importTimers", "saveManual", "diagnostics", "captureRestart", "hotkeyCapture", "shell", "clipboardRead", "clipboardWrite", "startup", "shutdown"] as const;
const reasons = ["npcap-missing", "npcap-access", "adapter-missing", "driver-start", "driver-stop", "driver-error", "driver-warning", "relay-duplicates", "unattributed-traffic", "unowned-socket", "litenet-decode", "fishnet-decode", "target-scan", "pending-expired", "pending-overflow", "unknown-context", "timestamp-invalid", "observation-invalid", "decode-error", "sleep-clock", "packet-stall", "window-placement", "settings-storage", "timer-storage"] as const;
const categories = ["network", "timeout", "canceled", "quota", "version", "missing-functions", "not-initialized", "generation", "clock", "validation", "storage", "native", "unknown"] as const;
export type ErrorCategory = typeof categories[number];
export interface LogContext {
  reason?: typeof reasons[number]; errorType?: string; errorCode?: string; site?: string;
  component?: "backend" | "capture" | "sharing" | "sync" | "storage" | "native";
  operation?: typeof operations[number]; requestId?: string; durationMs?: number; category?: ErrorCategory;
  phase?: "stopped" | "waiting" | "syncing" | "cleaning" | "backoff" | "paused" | "resetting";
  changed?: number; uploaded?: number; downloaded?: number; revision?: number; status?: number; suppressed?: number;
}
// Reconstruct records; never spread untrusted error objects, packet data or function arguments.
export function cleanContext(raw: LogContext): LogContext {
  const clean: LogContext = {};
  if (reasons.includes(raw.reason!)) clean.reason = raw.reason;
  if (["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "AggregateError", "AbortError"].includes(raw.errorType ?? "")) clean.errorType = raw.errorType;
  if (["EACCES", "EPERM", "ENOSPC", "ENOENT", "EIO", "ECONNRESET", "ECONNREFUSED", "ETIMEDOUT"].includes(raw.errorCode ?? "")) clean.errorCode = raw.errorCode;
  if (typeof raw.site === "string" && /^backend:\d{1,7}:\d{1,5}$/.test(raw.site)) clean.site = raw.site;
  if (["backend", "capture", "sharing", "sync", "storage", "native"].includes(raw.component ?? "")) clean.component = raw.component;
  if (operations.includes(raw.operation!)) clean.operation = raw.operation;
  if (categories.includes(raw.category!)) clean.category = raw.category;
  if (["stopped", "waiting", "syncing", "cleaning", "backoff", "paused", "resetting"].includes(raw.phase ?? "")) clean.phase = raw.phase;
  if (typeof raw.requestId === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(raw.requestId)) clean.requestId = raw.requestId;
  for (const key of ["durationMs", "changed", "uploaded", "downloaded", "revision", "status", "suppressed"] as const) {
    const n = raw[key]; if (typeof n === "number" && Number.isFinite(n) && n >= 0) clean[key] = Math.min(Math.floor(n), key === "durationMs" ? 3600000 : Number.MAX_SAFE_INTEGER);
  }
  return clean;
}
export function errorContext(error: unknown): LogContext {
  if (!(error instanceof Error)) return { category: "unknown" };
  const location = /(?:extensions[\\/]backend[\\/])index\.js:(\d+):(\d+)/.exec(error.stack ?? "");
  return cleanContext({ category: errorCategory(error), errorType: error.name, errorCode: (error as NodeJS.ErrnoException).code,
    site: location ? `backend:${location[1]}:${location[2]}` : undefined });
}
export function captureWarning(message: unknown): LogContext["reason"] {
  const text = typeof message === "string" ? message : "";
  if (/suppressed.*duplicate packets/i.test(text)) return "relay-duplicates";
  if (/could not be attributed/i.test(text)) return "unattributed-traffic";
  if (/does not own.*socket/i.test(text)) return "unowned-socket";
  if (/skipped LiteNetLib decode/i.test(text)) return "litenet-decode";
  if (/skipped FishNet decode/i.test(text)) return "fishnet-decode";
  if (/process.*snapshot|process.*query|target.*scan/i.test(text)) return "target-scan";
  return "driver-warning";
}
export function errorCategory(error: unknown): ErrorCategory {
  const message = error instanceof Error ? error.message : "";
  if (/connection changed|canceled/i.test(message)) return "canceled";
  if (/timed out|timeout/i.test(message)) return "timeout";
  if (/quota|rate.limit/i.test(message)) return "quota";
  if (/functions are missing/i.test(message)) return "missing-functions";
  if (/matching.*backend|version|protocol/i.test(message)) return "version";
  if (/metadata is missing|initializ/i.test(message)) return "not-initialized";
  if (/dataset.*changed|dataset.*reset|generation/i.test(message)) return "generation";
  if (/clock/i.test(message)) return "clock";
  if (/could not.*sav|could not.*read|folder|disk|EACCES|EPERM|ENOSPC/i.test(message)) return "storage";
  if (/could not reach|network|temporarily unavailable|fetch/i.test(message)) return "network";
  if (/invalid|reject|conflict|too large/i.test(message)) return "validation";
  return "unknown";
}
