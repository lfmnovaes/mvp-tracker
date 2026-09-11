import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Diagnostics } from "../src/backend/diagnostics";
import { Logger } from "../src/backend/logger";
import { defaults, VERSION, type Snapshot } from "../src/shared/protocol";
import { emptyCapture } from "../src/shared/capture";
import { errorCategory, type LogContext } from "../src/backend/log-context";
test("diagnostic exports exclude private settings, names, adapter labels and arbitrary log fields", () => {
  const root = mkdtempSync(join(tmpdir(), "mvp-diagnostics-test-"));
  try {
    const logger = new Logger(root);
    const time = new Date().toISOString();
    writeFileSync(join(root, "mvp-tracker.log"), [JSON.stringify({ time, event: "started", name: "SECRET-LOG" }), JSON.stringify({ time, event: "SECRET-EVENT" }), "broken"].join("\n"));
    const snapshot: Snapshot = { version: VERSION, settings: { ...defaults(), capture: { deviceName: "SECRET-DEVICE", manualCharacter: "SECRET-NAME" } },
      storageWritable: true, warning: "SECRET-PATH", trayReady: true, hotkeyErrors: {}, timers: [], diagnosticsUntil: 0,
      sharing: { configured: true, url: "SECRET-URL", state: "error", message: "SECRET-ERROR" },
      sync: { running: false, busy: false, queued: false, phase: "paused", interval: 60, message: "SECRET-MESSAGE", resetPending: false,
        dataset: { datasetId: "SECRET-DATASET", generation: 1, revision: 1, resetAt: 0 } },
      capture: { ...emptyCapture(), adapter: "SECRET-ADAPTER", detail: "SECRET-NATIVE-ERROR", character: "SECRET-LIVE", cachedCharacter: "SECRET-CACHED" } };
    const d = new Diagnostics(), now = Date.now(); d.start(now);
    for (let i = 0; i < 60; i++) d.tick(snapshot, now + i * 10000);
    const report = d.report(snapshot, logger.recent(), now + 600000);
    expect(report).not.toContain("SECRET");
    expect(JSON.parse(report).events).toEqual([{ time, event: "started" }]);
    expect(JSON.parse(report).samples.length).toBeLessThanOrEqual(30); expect(d.until).toBe(0);
    expect(JSON.parse(report).version).toBe(VERSION);
    expect(JSON.parse(report).schemaVersion).toBe(2);
    expect(JSON.parse(report).health.sync.phase).toBe("paused");
    expect(JSON.parse(report).health.sync.revision).toBe(1);
    expect(JSON.parse(report).health.timers).toEqual({ total: 0, outdated: 0 });
  } finally {
    if (!root.startsWith(join(tmpdir(), "mvp-diagnostics-test-"))) throw new Error("Unsafe cleanup.");
    rmSync(root, { recursive: true, force: true });
  }
});

test("structured logs keep diagnostic context but reject names, paths, raw errors and arbitrary fields", () => {
  const root = mkdtempSync(join(tmpdir(), "mvp-diagnostics-test-"));
  try {
    let now = Date.now(); const logger = new Logger(root, undefined, undefined, undefined, () => now);
    const id = crypto.randomUUID();
    const fields = { component: "sharing", operation: "test", requestId: id, durationMs: 120, status: 503, category: "quota", player: "SECRET-NAME", url: "SECRET-URL", stack: "SECRET-STACK" } as LogContext;
    logger.write("sharing-failed", fields);
    for (let i = 0; i < 20; i++) logger.write("sharing-failed", { ...fields, requestId: crypto.randomUUID() });
    expect(logger.recent()).toHaveLength(1);
    now += 60000; logger.write("sharing-failed", fields);
    expect(logger.recent()[1]).toMatchObject({ component: "sharing", operation: "test", requestId: id, durationMs: 120, category: "quota", suppressed: 20, version: VERSION });
    logger.write("sharing-request", { component: "SECRET", operation: "SECRET", requestId: "SECRET", category: "SECRET", durationMs: Infinity } as unknown as LogContext);
    expect(readFileSync(join(root, "mvp-tracker.log"), "utf8")).not.toContain("SECRET");
    expect(JSON.stringify(logger.recent())).not.toContain("SECRET");
    expect(errorCategory(new Error("Sharing: The request timed out."))).toBe("timeout");
    logger.clear(); logger.write("sharing-failed", fields); expect(logger.recent()).toHaveLength(1);
  } finally { if (!root.startsWith(join(tmpdir(), "mvp-diagnostics-test-"))) throw new Error("Unsafe cleanup."); rmSync(root, { recursive: true, force: true }); }
});
