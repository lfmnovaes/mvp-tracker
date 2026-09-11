import { test, expect, afterEach } from "bun:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaults, parseRequest, parseSettings, requestId } from "../src/shared/protocol";
import { SettingsStore } from "../src/backend/storage";
import { Logger } from "../src/backend/logger";
const roots: string[] = [];
function temporary() { const root = mkdtempSync(join(tmpdir(), "mvp-tracker-test-")); roots.push(root); return root; }
afterEach(() => { for (const root of roots.splice(0)) { if (!root.startsWith(join(tmpdir(), "mvp-tracker-test-"))) throw new Error("Unsafe test cleanup."); rmSync(root, { recursive: true, force: true }); } });
test("portable preferences survive restart without temporary files", () => {
  const root = temporary(); const store = new SettingsStore(root);
  const changed = { ...defaults(), startMinimized: true, hotkeys: { toggle: "Ctrl+F7", add: "", sync: "F9" } };
  store.save(changed);
  expect(new SettingsStore(root).load()).toEqual(changed);
  expect(readdirSync(join(root, "data"))).toEqual(["settings.json"]);
});
test("invalid or future settings preserve original bytes, and valid save recovers", () => {
  const root = temporary(); const store = new SettingsStore(root);
  writeFileSync(store.file, '{"schemaVersion":99}');
  expect(store.load()).toEqual(defaults()); expect(store.warning).toContain("preserved");
  expect(readFileSync(store.file, "utf8")).toBe('{"schemaVersion":99}');
  store.save(defaults()); expect(store.warning).toBeNull();
});
test("a blocked portable directory produces read-only state instead of fallback", () => {
  const root = temporary(); writeFileSync(join(root, "data"), "blocked");
  const store = new SettingsStore(root); expect(store.writable).toBe(false);
  expect(() => store.save(defaults())).toThrow("read-only");
});
test("duplicate, bare-letter and reserved shortcut bindings are rejected", () => {
  for (const bad of ["F12", "Q", "Meta+F7", "Ctrl+Ctrl+F7", "f7", "F25"]) {
    expect(() => parseSettings({ ...defaults(), hotkeys: { ...defaults().hotkeys, toggle: bad } })).toThrow();
  }
  expect(() => parseSettings({ ...defaults(), hotkeys: { toggle: "F7", add: "F7", sync: "F9" } })).toThrow("unique");
  expect(parseSettings({ ...defaults(), hotkeys: { toggle: "Ctrl+Alt+Shift+A", add: "", sync: "F24" } }).hotkeys.add).toBe("");
});
test("IPC validates method, ID, input and clipboard bounds", () => {
  for (const raw of [null, { id: "a", method: "shell", input: "exec" }, { id: "../a", method: "snapshot", input: null }, { id: "a", method: "clipboardRead", input: true }, { id: "a", method: "clipboardWrite", input: "x".repeat(1_000_001) }]) expect(() => parseRequest(raw)).toThrow();
  expect(parseRequest({ id: "good-id", method: "clipboardWrite", input: "example" }).method).toBe("clipboardWrite");
});

test("invalid request bodies retain a safe reply ID and clearing logs preserves unrelated files", () => {
  const raw = { id: "reply-to-invalid-save", method: "sharingSave", input: { url: "bad", groupKey: "" } };
  const id = requestId(raw); expect(() => parseRequest(raw)).toThrow(); expect(id).toBe(raw.id);
  expect(requestId({ id: "../bad" })).toBeUndefined();
  const root = temporary(), log = new Logger(root); log.write("started"); writeFileSync(join(root, "keep.txt"), "unrelated");
  log.clear(); expect(readdirSync(root)).toEqual(["keep.txt"]); log.write("started"); expect(log.recent()).toHaveLength(1);
});
test("logs rotate at their byte cap, retain five files and prune old logs", () => {
  const root = temporary(); const log = new Logger(root, 150, 5, 1000);
  for (let i = 0; i < 30; i++) log.write("started");
  expect(readdirSync(root).length).toBe(5);
  for (const file of readdirSync(root)) {
    const text = readFileSync(join(root, file), "utf8"); expect(Buffer.byteLength(text)).toBeLessThanOrEqual(150);
    for (const line of text.trim().split("\n")) expect(Object.keys(JSON.parse(line))).toEqual(["time", "event", "version", "level"]);
    utimesSync(join(root, file), new Date(0), new Date(0));
  }
  log.write("started"); expect(readdirSync(root)).toEqual(["mvp-tracker.log"]);
});
