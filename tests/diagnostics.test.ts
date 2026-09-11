import { expect, test } from "bun:test";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Diagnostics } from "../src/backend/diagnostics";
import { Logger } from "../src/backend/logger";
import { defaults, VERSION, type Snapshot } from "../src/shared/protocol";
import { emptyCapture } from "../src/shared/capture";
test("diagnostic exports exclude private settings, names, adapter labels and arbitrary log fields", () => {
  const root = mkdtempSync(join(tmpdir(), "mvp-diagnostics-test-"));
  try {
    const logger = new Logger(root);
    const time = new Date().toISOString();
    writeFileSync(join(root, "mvp-tracker.log"), [JSON.stringify({ time, event: "started", name: "SECRET-LOG" }), JSON.stringify({ time, event: "SECRET-EVENT" }), "broken"].join("\n"));
    const snapshot: Snapshot = { version: VERSION, settings: { ...defaults(), capture: { deviceName: "SECRET-DEVICE", manualCharacter: "SECRET-NAME" } },
      storageWritable: true, warning: "SECRET-PATH", trayReady: true, hotkeyErrors: {}, timers: [], diagnosticsUntil: 0,
      capture: { ...emptyCapture(), adapter: "SECRET-ADAPTER", detail: "SECRET-NATIVE-ERROR", character: "SECRET-LIVE", cachedCharacter: "SECRET-CACHED" } };
    const d = new Diagnostics(), now = Date.now(); d.start(now);
    for (let i = 0; i < 60; i++) d.tick(snapshot, now + i * 10000);
    const report = d.report(snapshot, logger.recent(), now + 600000);
    expect(report).not.toContain("SECRET");
    expect(JSON.parse(report).events).toEqual([{ time, event: "started" }]);
    expect(JSON.parse(report).samples.length).toBeLessThanOrEqual(30); expect(d.until).toBe(0);
    expect(JSON.parse(report).version).toBe(VERSION);
  } finally {
    if (!root.startsWith(join(tmpdir(), "mvp-diagnostics-test-"))) throw new Error("Unsafe cleanup.");
    rmSync(root, { recursive: true, force: true });
  }
});
