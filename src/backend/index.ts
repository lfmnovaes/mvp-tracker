import { resolve, join } from "node:path";
import { NeutralinoClient } from "./neutralino-client";
import { SettingsStore } from "./storage";
import { SharingConnection } from "./sharing";
import { SyncCoordinator } from "./sync-coordinator";
import { Logger } from "./logger";
import { TimerStore } from "./timer-store";
import { CaptureService } from "./capture-service";
import { emptyCapture } from "../shared/capture";
import { Diagnostics } from "./diagnostics";
import { decodeImport, exportTimers, previewImport } from "./exchange";
import { compareEvidence, parseObservation, slotKey, type Observation } from "../domain/timers";
import { VERSION, REQUEST, RESPONSE, UPDATE, parseRequest, requestId, type Snapshot, type Update, type Action } from "../shared/protocol";

const root = resolve(import.meta.dir, "../..");
const native = await NeutralinoClient.fromStdin();
let exiting = false;
let ready = false;
let uiReady = false;
let companion: ReturnType<typeof Bun.spawn> | undefined;
let store: SettingsStore;
let logger: Logger;
let timers: TimerStore;
let capture: CaptureService | undefined;
let sharing: SharingConnection;
let sync: SyncCoordinator;
const diagnostics = new Diagnostics();
const pendingObservations = new Map<string, Observation>();
function flushObservations() {
  if (!pendingObservations.size) return false;
  const entries = [...pendingObservations.values()]; pendingObservations.clear();
  // A system-clock correction between receipt and flush must not terminate the app.
  const now = Date.now();
  const valid = entries.filter(entry => {
    try { parseObservation(entry, now); return true; }
    catch { logger?.write("capture-packet-rejected"); return false; }
  });
  return valid.length ? timers.ingest(valid) : false;
}
let cleanupTimer: ReturnType<typeof setInterval> | undefined;
let state!: Snapshot;
function send(command: string, extras: Record<string, unknown> = {}) {
  if (!companion || !companion.stdin || typeof companion.stdin === "number") throw new Error("Windows companion unavailable.");
  companion.stdin.write(JSON.stringify({ command, ...extras }) + "\n");
}
async function publish(update: Update) { await native.call("app.broadcast", { event: UPDATE, data: update }); }
async function showFallback() {
  await native.call("window.show");
  if (await native.call<boolean>("window.isMinimized")) await native.call("window.unminimize");
  await native.call("window.focus");
}
async function shellAction(action: string) {
  if (action === "sync") { sync?.request(); return; }
  if (action === "exit") { void exitApp(); return; }
  if (action === "toggle") action = await native.call<boolean>("window.isVisible") && !await native.call<boolean>("window.isMinimized") ? "hide" : "show";
  if (action === "hide") {
    if (state?.trayReady) await native.call("window.hide");
    else await showFallback();
  } else if (action === "minimize") await native.call("window.minimize");
  else if (["show", "settings", "add"].includes(action)) {
    await showFallback();
    if (companion?.exitCode === null) send("recover");
  }
  if (["show", "settings", "add", "sync"].includes(action)) await publish({ type: action as "show" | "settings" | "add" | "sync" });
}
async function exitApp() {
  if (exiting) return; exiting = true;
  sync?.close();
  sharing?.close();
  clearInterval(cleanupTimer); await capture?.stop(); flushObservations(); timers?.close();
  logger?.write("stopped");
  try { send("exit"); } catch { }
  if (companion) {
    await Promise.race([companion.exited, Bun.sleep(1500)]);
    if (companion.exitCode === null) companion.kill();
  }
  try { await native.call("app.exit", { code: 0 }); } finally { process.exit(0); }
}
native.onClose(() => {
  exiting = true;
  sync?.close();
  sharing?.close();
  clearInterval(cleanupTimer); void capture?.stop(); flushObservations(); timers?.close();
  try { send("exit"); } catch { }
  void Promise.race([companion?.exited ?? Promise.resolve(), Bun.sleep(1500)]).then(() => {
    if (companion?.exitCode === null) companion.kill();
    process.exit(0);
  });
});
process.on("SIGINT", () => void exitApp());
process.on("SIGTERM", () => void exitApp());
process.on("uncaughtException", () => { logger?.write("fatal"); void exitApp(); });
process.on("unhandledRejection", () => { logger?.write("fatal"); void exitApp(); });
native.on("windowClose", () => {
  if (ready && state.trayReady) void shellAction("hide");
  else void showFallback();
});
// Serialize mutations so a Save and an Exit cannot interleave writes.
let queue = Promise.resolve();
native.on(REQUEST, raw => {
  // Network tests must not hold the local write queue: connection changes and Exit can cancel them.
  if (["sharingTest", "sharingReset"].includes((raw as { method: string })?.method)) {
    void (async () => {
      let id = requestId(raw);
      try {
        const request = parseRequest(raw); id = request.id;
        if (!ready || exiting) throw new Error();
        const result = request.method === "sharingReset" ? (await sync.reset(request.input), sync.snapshot()) : await sharing.test();
        await native.call("app.broadcast", { event: RESPONSE, data: { id, result } });
      } catch (e) { if (id) await native.call("app.broadcast", { event: RESPONSE, data: { id, error: e instanceof Error && e.message.startsWith("Sharing:") ? e.message : "Sharing: connection action unavailable. Retry after startup." } }).catch(() => {}); }
    })(); return;
  }
  queue = queue.then(async () => {
    let id = requestId(raw);
    try {
      const request = parseRequest(raw); id = request.id;
      if (!ready) throw new Error("The Windows shell is starting. Please try again.");
      let result: unknown = null;
      switch (request.method) {
        case "sharingRead": result = sharing.credentials(); break;
        case "sharingSave": {
          const before = sharing.credentials(); result = sharing.configure(request.input);
          if (before.url !== request.input.url) sync.connectionChanged();
          if (request.input.url) void sharing.prepare(); break;
        }
        case "syncControl":
          if (request.input === "start") sync.start(); else if (request.input === "stop") sync.stop(); else sync.request();
          result = sync.snapshot(); break;
        case "pruneOutdated": sync.requestPrune(); result = sync.snapshot(); break;
        case "syncInterval":
          store.save({ ...state.settings, syncInterval: request.input }); state.settings.syncInterval = request.input; sync.setInterval(request.input); result = state; break;
        case "removeTimer": {
          pendingObservations.delete(slotKey(request.input));
          timers.remove(request.input); state.timers = timers.selectedSnapshot(); state.warning = timers.warning ?? store.warning;
          result = state; await publish({ type: "snapshot", value: state }); break;
        }
        case "exportTimers": {
          flushObservations();
          const exported = exportTimers(timers.snapshot(), state.settings.tracking, Date.now(), request.input);
          if (!exported.count) throw new Error("Export has no current selected observations for this format. Clipboard was left unchanged.");
          await native.call("clipboard.writeText", { data: exported.text }); result = exported.count; break;
        }
        case "importTimers": {
          const now = Date.now();
          const incoming = decodeImport(request.input.text, now);
          // Preview is read-only. Confirmation remerges against the latest capture and preferences.
          const current = request.input.commit ? (flushObservations(), timers.snapshot()) : [...timers.snapshot()];
          const preview = previewImport(current, incoming, state.settings.tracking, now);
          if (request.input.commit) {
            timers.ingest(preview.observations); state.timers = timers.selectedSnapshot(); state.warning = timers.warning ?? store.warning;
            await publish({ type: "snapshot", value: state });
          }
          result = { summary: preview.summary, ...(request.input.commit ? { snapshot: state } : {}) }; break;
        }
        case "saveManual": {
          flushObservations();
          if (request.input.mode === "edit" && !timers.selectedSnapshot().some(s => slotKey(s) === slotKey(request.input.entry))) throw new Error("Invalid edit: this timer is no longer available.");
          timers.saveManual({ ...request.input.entry, observedByCharacter: capture?.snapshot().identity.name });
          state.timers = timers.selectedSnapshot(); state.warning = timers.warning ?? store.warning;
          result = state; await publish({ type: "snapshot", value: state }); break;
        }
        case "diagnostics": {
          if (request.input === "open") {
            const explorer = Bun.spawn([join(process.env.WINDIR ?? "C:/Windows", "explorer.exe"), join(root, "logs")], { stdin: "ignore", stdout: "ignore", stderr: "ignore", windowsHide: false });
            explorer.unref(); result = "Opened the logs folder.";
          } else if (request.input === "clear") { logger.clear(); result = "Logs cleared."; } else if (request.input === "copy") {
            await native.call("clipboard.writeText", { data: diagnostics.report(state, logger.recent(), Date.now()) }); result = "Sanitized diagnostics copied to the clipboard.";
          } else {
            if (request.input === "start") diagnostics.start(Date.now()); else diagnostics.stop();
            state.diagnosticsUntil = diagnostics.until;
            result = request.input === "start" ? "Health sampling started for five minutes." : "Health sampling stopped.";
            await publish({ type: "snapshot", value: state });
          }
          break;
        }
        case "captureRestart": void capture?.restart(); break;
        case "hotkeyCapture": send("capture", { active: request.input }); break;
        case "snapshot":
          if (!uiReady) {
            uiReady = true;
            // Let WebView2 finish its first layout before hiding; hiding during creation can leave it unpainted.
            if (state.settings.startMinimized && state.trayReady) setTimeout(() => { if (!exiting) void shellAction("hide"); }, 500);
          }
          state.timers = timers.selectedSnapshot();
          state.capture = capture?.snapshot() ?? emptyCapture();
          state.warning = timers.warning ?? store.warning ?? state.warning;
          result = state; break;
        case "saveSettings":
          store.save(request.input); state.settings = request.input;
          timers.setSelection(request.input.tracking); state.timers = timers.selectedSnapshot();
          capture?.configure(request.input.capture); state.capture = capture?.snapshot() ?? emptyCapture();
          if (sync.snapshot().interval !== request.input.syncInterval) sync.setInterval(request.input.syncInterval);
          state.warning = timers.warning ?? store.warning; logger.write("settings-saved");
          if (companion?.exitCode === null) send("configure", { hotkeys: state.settings.hotkeys }); result = state; break;
        case "shell":
          if (request.input === "exit") { void exitApp(); return; }
          if (!companion || companion.exitCode !== null) {
            if (request.input === "show") await showFallback();
            else if (request.input === "minimize") await native.call("window.minimize");
            else throw new Error("Tray is unavailable. Keep this window open or use Exit.");
          } else await shellAction(request.input);
          break;
        case "clipboardRead": {
          const value = await native.call<string>("clipboard.readText");
          if (typeof value !== "string" || value.length > 1_000_000) throw new Error("Clipboard text is too large.");
          result = value; break;
        }
        case "clipboardWrite": await native.call("clipboard.writeText", { data: request.input }); break;
      }
      await native.call("app.broadcast", { event: RESPONSE, data: { id, result } });
    } catch (error) {
      logger?.write("rpc-failed");
      // Only our deliberate validation/storage errors reach the UI; native payloads never do.
      const message = error instanceof Error && /^(Logs could|Sharing:|Invalid|Import|Export|Kill time|Use F|Each enabled|Portable|Settings could|Clipboard|The Windows|Tray is|Unknown method)/.test(error.message)
        ? error.message : "The action failed. Please retry or restart MVP Tracker.";
      if (id) await native.call("app.broadcast", { event: RESPONSE, data: { id, error: message } }).catch(() => {});
    }
  });
});
async function initialize(trayReady: boolean) {
  store = new SettingsStore(root);
  logger = new Logger(join(root, "logs"));
  const settings = store.load();
  timers = new TimerStore(root, settings.tracking);
  state = { version: VERSION, settings, storageWritable: store.writable,
    warning: timers.warning ?? store.warning ?? (!logger.available ? "Logs cannot be saved in this portable folder." : null), trayReady, hotkeyErrors: {}, timers: timers.selectedSnapshot(), capture: emptyCapture(), diagnosticsUntil: 0 };
  sharing = new SharingConnection(root, () => {
    state.sharing = sharing.snapshot();
    if (!exiting) void publish({ type: "snapshot", value: state }).catch(() => {});
  });
  state.sharing = sharing.snapshot();
  sync = new SyncCoordinator(sharing, timers, () => state.settings.tracking, () => capture?.snapshot().identity.name, flushObservations, () => {
    state.sync = sync.snapshot(); state.timers = timers.selectedSnapshot(); state.warning = timers.warning ?? store.warning;
    if (!exiting) void publish({ type: "snapshot", value: state }).catch(() => {});
  }, settings.syncInterval);
  state.sync = sync.snapshot();
  capture = new CaptureService(settings.capture, observation => {
    const key = slotKey(observation), pending = pendingObservations.get(key);
    if (!exiting && (!pending || compareEvidence(observation, pending) > 0)) pendingObservations.set(key, observation);
  }, undefined, Date.now, event => logger.write(event));
  void capture.restart();
  if (!trayReady) state.warning = "Tray is unavailable. Keep the window open; Exit is available in Settings.";
  logger.write("started"); if (!store.writable) logger.write("storage-unavailable");
  ready = true;
  if (companion?.exitCode === null) send("configure", { hotkeys: settings.hotkeys });
  await shellAction("show");
  await publish({ type: "snapshot", value: state });
  let cleanupTicks = 0;
  let timerWarning = timers.warning;
  if (timerWarning) logger.write("timer-storage-unavailable");
  cleanupTimer = setInterval(() => {
    if (exiting) return;
    capture?.tick();
    const observationsChanged = flushObservations();
    const changed = timers.expire() || observationsChanged;
    const captureState = capture?.snapshot() ?? emptyCapture();
    const captureChanged = JSON.stringify(captureState) !== JSON.stringify(state.capture);
    state.capture = captureState;
    diagnostics.tick(state, Date.now());
    const diagnosticsChanged = state.diagnosticsUntil !== diagnostics.until;
    state.diagnosticsUntil = diagnostics.until;
    if (++cleanupTicks % 30 === 0) timers.flush();
    const warningChanged = timerWarning !== timers.warning;
    if (warningChanged) {
      logger.write(timers.warning ? "timer-storage-unavailable" : "timer-storage-restored");
      if (timers.warning || state.warning === timerWarning) state.warning = timers.warning ?? store.warning;
      timerWarning = timers.warning;
    }
    if (changed || warningChanged || captureChanged || diagnosticsChanged) {
      state.timers = timers.selectedSnapshot();
      if (timers.warning) state.warning = timers.warning;
      void publish({ type: "snapshot", value: state }).catch(() => {});
    }
  }, 1000);
}
try {
  companion = Bun.spawn([join(root, "extensions", "bin", "mvp-shell.exe"), String(process.pid), join(root, "extensions", "bin", "icon.ico")], {
    stdin: "pipe", stdout: "pipe", stderr: "ignore", windowsHide: true,
  });
  const timeout = setTimeout(() => {
    if (!ready && !exiting) { companion?.kill(); void initialize(false); }
  }, 10_000);
  void (async () => {
    const reader = companion!.stdout;
    if (!reader || typeof reader === "number") throw new Error("No companion stream.");
    let partial = "";
    for await (const chunk of reader) {
      partial += new TextDecoder().decode(chunk);
      if (partial.length > 32_000) throw new Error("Invalid companion response.");
      let newline: number;
      while ((newline = partial.indexOf("\n")) >= 0) {
        const line = partial.slice(0, newline); partial = partial.slice(newline + 1);
        let message: Record<string, unknown>; try { message = JSON.parse(line); } catch { continue; }
        if (message.type === "duplicate") { clearTimeout(timeout); await exitApp(); return; }
        if (message.type === "ready") { clearTimeout(timeout); if (!ready) await initialize(message.trayReady === true); }
        else if (message.type === "hotkeys" && ready) {
          state.hotkeyErrors = message.errors as Partial<Record<Action, string>>;
          await publish({ type: "snapshot", value: state });
        } else if (message.type === "action") {
          if (["exit", "settings", "add", "sync", "show", "hide", "toggle", "minimize"].includes(String(message.action))) await shellAction(String(message.action));
        } else if (message.type === "warning" && ready) await publish({ type: "snapshot", value: state });
      }
    }
  })().catch(() => { logger?.write("native-unavailable"); });
  void companion.exited.then(async () => {
    clearTimeout(timeout);
    if (exiting) return;
    if (!ready) await initialize(false);
    state.trayReady = false; state.warning = "The Windows companion stopped. Restart MVP Tracker to restore tray and shortcuts.";
    logger.write("native-exited"); await showFallback(); await publish({ type: "snapshot", value: state });
  });
} catch { await initialize(false); }
// If the view never connects, expose the window for diagnosis rather than trapping it in the tray.
setTimeout(() => { if (!uiReady && !exiting) { logger?.write("frontend-timeout"); void showFallback(); } }, 20_000);
