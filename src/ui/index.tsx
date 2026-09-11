import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ACTIONS, VERSION, defaults, parseSettings, type Action, type Settings, type Snapshot } from "../shared/protocol";
import { call, connect, emergencyExit, subscribe } from "./bridge";
import { BOSSES, REGIONS, bossPreset, defaultSelection, type Region, type Channel } from "../domain/catalog";
import { defaultSort, queryTimers, type SortField } from "../domain/query";
import { formatClock, formatTimestamp } from "../domain/time";
import { slotKey, type TimerSlot } from "../domain/timers";
import { emptyCapture } from "../shared/capture";
import { ManualDialog } from "./manual-dialog";
import { TimerRowView } from "./timer-row";
import { ImportDialog } from "./import-dialog";
import type { Connection } from "../shared/sharing";
import { SharingSettings } from "./sharing-settings";
import type { ExportFormat } from "../shared/exchange";

const labels: Record<Action, string> = { toggle: "Show / hide tracker", add: "Add manually", sync: "Sync" };
type Tab = "General" | "Tracking" | "Sharing" | "Capture & diagnostics";
function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [notification, setNotification] = useState({ text: "", id: 0 });
  const message = notification.text;
  const setMessage = (text: string) => setNotification(current => ({ text, id: current.id + 1 }));
  const [cleanupAt, setCleanupAt] = useState<number | null>(null);
  useEffect(() => {
    if (!notification.text) return;
    const timer = setTimeout(() => setNotification(current => current.id === notification.id ? { ...current, text: "" } : current), 10_000);
    return () => clearTimeout(timer);
  }, [notification.id]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("General");
  const [draft, setDraft] = useState<Settings>(defaults());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  const [sorting, setSorting] = useState(false);
  const [manual, setManual] = useState<{ edit?: TimerSlot } | null>(null);
  const [region, setRegion] = useState<Region | "">("");
  const [channel, setChannel] = useState<Channel | "">("");
  const [connected, setConnected] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("text");
  const [exporting, setExporting] = useState(false);
  const [focusedOrder, setFocusedOrder] = useState<string[] | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const [connectionDraft, setConnectionDraft] = useState<Connection | null>(null);
  const [connectionSaved, setConnectionSaved] = useState<Connection | null>(null);
  const openSettings = () => { setDraft(snapshot?.settings ?? defaults()); setSettingsOpen(true); setMessage(""); };
  useEffect(() => {
    const sync = snapshot?.sync;
    if (sync?.message.startsWith("Removed")) { setCleanupAt(Date.now()); setMessage(sync.message); }
    else if (sync?.phase === "paused" || sync?.phase === "backoff") setMessage(sync.message);
  }, [snapshot?.sync?.message]);
  const action = (name: "add" | "sync") => { if (name === "add") { setSettingsOpen(false); setManual(current => current ?? {}); } else void call("syncControl", "now").catch(e => setMessage(e.message)); };
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, []);
  useEffect(() => {
    let disposed = false;
    const off = subscribe(update => {
      if (update.type === "snapshot") { setSnapshot(update.value); setConnected(true); }
      else if (update.type === "settings") { setSettingsOpen(true); setMessage(""); }
      else if (update.type === "add" || update.type === "sync") action(update.type);
    });
    void (async () => {
      try {
        await connect();
        for (let i = 0; i < 12 && !disposed; i++) {
          try { const value = await call("snapshot", null); if (!disposed) { setSnapshot(value); setConnected(true); setDraft(value.settings); setError(""); } return; }
          catch (e) { if (i === 11) throw e; await new Promise(r => setTimeout(r, 500)); }
        }
      } catch { if (!disposed) setError("MVP Tracker could not start its backend. Try restarting the app. Check that the portable ZIP was fully extracted."); }
    })();
    let polling = false;
    const heartbeat = setInterval(() => {
      if (polling) return; polling = true;
      void call("snapshot", null).then(value => { if (!disposed) { setSnapshot(value); setConnected(true); } })
        .catch(() => { if (!disposed) setConnected(false); }).finally(() => { polling = false; });
    }, 5000);
    return () => { disposed = true; off(); clearInterval(heartbeat); };
  }, []);
  useEffect(() => {
    let disposed = false;
    if (settingsOpen) { setConnectionDraft(null); setConnectionSaved(null); void call("sharingRead", null).then(value => { if (!disposed) { setConnectionDraft(value); setConnectionSaved(value); } }).catch(() => { if (!disposed) setMessage("Could not load Sharing settings."); }); setDraft(snapshot?.settings ?? defaults()); dialog.current?.showModal(); }
    else dialog.current?.close();
    return () => { disposed = true; };
  }, [settingsOpen]);
  const shell = async (command: "hide" | "minimize" | "exit") => {
    try { if (!snapshot && command === "exit") await emergencyExit(); else await call("shell", command); }
    catch (e) { if (command === "exit") await emergencyExit(); else setError((e as Error).message); }
  };
  const save = async () => {
    setSaving(true); setMessage("");
    try { const checked = parseSettings(draft); if (connectionDraft) { const saved = await call("sharingSave", connectionDraft); const normalized = { url: saved.url }; setConnectionSaved(normalized); setConnectionDraft(normalized); } setSnapshot(await call("saveSettings", checked)); setMessage("Settings saved."); }
    catch (e) { setMessage((e as Error).message); }
    finally { setSaving(false); }
  };
  const selection = snapshot?.settings.tracking ?? defaultSelection();
  useEffect(() => { if (region && !selection.regions.includes(region)) setRegion(""); }, [selection.regions.join(",")]);
  useEffect(() => { document.documentElement.style.setProperty("--ui-scale", String((snapshot?.settings.uiScale ?? 100) / 100)); }, [snapshot?.settings.uiScale]);
  const sort = snapshot?.settings.sort ?? defaultSort();
  const rows = queryTimers(snapshot?.timers ?? [], selection, now, { search, sort, region: region || undefined, channel: channel || undefined });
  // Defer automatic row movement while its actions have keyboard focus.
  const order = new Map(focusedOrder?.map((key, index) => [key, index]));
  const displayRows = focusedOrder ? [...rows].sort((a, b) => (order.get(slotKey(a.slot)) ?? Infinity) - (order.get(slotKey(b.slot)) ?? Infinity)) : rows;
  const noneSelected = selection.bossIds.length === 0 || selection.regions.length === 0;
  const health = snapshot?.capture ?? emptyCapture();
  const silent = health.game === "active" && health.lastPacketAt !== undefined && now - health.lastPacketAt > 90000;
  const captureLabel = !connected ? "Capture status unavailable" : health.state === "running" ? silent ? "Capture stalled" : health.game === "active" && !health.lastPacketAt ? "Waiting for game packets" : "Capture active" : health.state === "starting" ? "Capture starting" : "Capture inactive";
  const gameLabel = health.game === "active" ? "Game running" : health.game === "waiting" ? "Waiting for game" : "Game detection unavailable";
  const retryCapture = async () => {
    try { await call("captureRestart", null); setMessage("Retrying capture and refreshing adapters…"); }
    catch (e) { setMessage((e as Error).message); }
  };
  const diagnosticsAction = async (input: "open" | "clear" | "copy" | "start" | "stop") => {
    try { setMessage(await call("diagnostics", input)); } catch (e) { setMessage((e as Error).message); }
  };
  const exportClipboard = async () => {
    if (exporting) return; setExporting(true);
    try { const count = await call("exportTimers", exportFormat); setMessage(`Copied ${count} observations as ${exportFormat}.`); }
    catch (e) { setMessage((e as Error).message); } finally { setExporting(false); }
  };
  const changeSort = async (field: SortField) => {
    if (!snapshot || sorting) return; setSorting(true);
    try { setSnapshot(await call("saveSettings", { ...snapshot.settings, sort: { field, direction: sort.field === field && sort.direction === "asc" ? "desc" : "asc" } })); }
    catch (e) { setError((e as Error).message); } finally { setSorting(false); }
  };
  const removeTimer = async (slot: TimerSlot) => {
    try { setSnapshot(await call("removeTimer", slot)); setFocusedOrder(null); setMessage("Timer removed locally. A new capture or import can add it again."); }
    catch (e) { setMessage((e as Error).message); }
  };
  return <main>
    <header class="titlebar">
      <div id="drag-region" class="brand"><img src="/icon.png" alt=""/><strong>MVP <span>TRACKER</span></strong><small>SPIRIT VALE</small></div>
      <div class="window-actions"><button aria-label="Settings" title="Settings" onClick={openSettings}>⚙</button><button aria-label="Minimize" title="Minimize to taskbar" onClick={() => void shell("minimize")}>−</button><button class="close" aria-label="Hide to tray" title="Hide to tray · keeps running" onClick={() => void shell("hide")}>×</button></div>
    </header>
    <section class="health" aria-label="Capture status" title={health.detail}><span class={`status-dot ${connected && health.state === "running" && !silent ? "active" : ""}`}/><strong>{captureLabel}</strong><span class="divider"/><span>{connected ? gameLabel : "Game detection unavailable"}</span><span class="health-right">{connected ? "Shell ready" : snapshot ? "Backend reconnecting…" : "Starting…"}</span></section>
    <div class="table-toolbar"><div class="search-wrap"><svg class="search-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input aria-label="Search bosses" placeholder="Search boss, map, killer · e.g. paladin sa ch2" value={search} onInput={e => setSearch(e.currentTarget.value)} maxLength={200}/></div><select aria-label="Filter region" value={region} onChange={e => setRegion(e.currentTarget.value as Region | "")}><option value="">All regions</option>{selection.regions.map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}</select><select aria-label="Filter channel" value={channel} onChange={e => setChannel(e.currentTarget.value ? Number(e.currentTarget.value) as Channel : "")}><option value="">All channels</option>{[1, 2, 3].map(c => <option key={c} value={c}>Ch {c}</option>)}</select><span class="count">{rows.length} tracked</span></div>
    <div class="workspace">
      {(error || snapshot?.warning) && <div class="notice warning" role="alert">{error || snapshot?.warning}{error && <button onClick={() => void shell("exit")}>Exit app</button>}</div>}
      {health.state === "unavailable" && <div class="notice warning" role="status">{health.detail}<button onClick={() => { openSettings(); setTab("Capture & diagnostics"); }}>Capture settings</button></div>}
      <section class="tracker-card" aria-label="Boss timers">

        <div class="table-scroll"><table><thead><tr>{([["boss", "Boss"], ["level", "Level"], ["location", "Location"], ["region", "Region"], ["channel", "Channel"], ["status", "Status"], ["gathered", "Gathered at"], ["killer", "Killer"]] as [SortField, string][]).map(([field, label]) => <th key={field} aria-sort={sort.field === field ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button disabled={sorting || !connected} onClick={() => void changeSort(field)}>{label}{sort.field === field ? sort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>)}<th class="actions-heading">Actions</th></tr></thead>
          <tbody onFocusCapture={() => setFocusedOrder(current => current ?? rows.map(row => slotKey(row.slot)))} onBlurCapture={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusedOrder(null); }}>{displayRows.map(row => <TimerRowView key={slotKey(row.slot)} row={row} clock24={snapshot?.settings.clock24 ?? true} onEdit={slot => setManual({ edit: slot })} onRemove={removeTimer}/>)}</tbody></table>
        {rows.length === 0 && <div class="empty"><div class="empty-icon">◷</div><h2>{noneSelected ? "Nothing selected for tracking" : snapshot?.timers.length ? "No matching timers" : "No boss observations yet"}</h2><p>{noneSelected ? "Choose bosses and regions in Settings to start tracking." : snapshot?.timers.length ? "Try another boss name, region or channel, or clear your filters." : "Walk near a gravestone in the game to collect a timer. Capture continues while the window is hidden."}</p><span class="empty-tag">MVP TRACKER · v{VERSION}</span></div>}</div>

      </section>

      {message && !settingsOpen && <div class="notice" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage("")}>×</button></div>}
    </div>
    <footer class="footer"><div class="exchange"><button class="primary" disabled={!connected || noneSelected} onClick={() => action("add")}>＋ Add manually</button><select aria-label="Export format" value={exportFormat} onChange={e => setExportFormat(e.currentTarget.value as ExportFormat)}><option value="text">Text</option><option value="json">JSON</option><option value="compressed">Compressed</option></select><button disabled={!connected || exporting} onClick={() => void exportClipboard()}>{exporting ? "Copying…" : "Export"}</button><button disabled={!connected} onClick={() => setImporting(true)}>Import</button></div><div class="sync"><span class="sync-summary" title={snapshot?.sync?.message}>{snapshot?.sync?.queued ? "Sync queued" : snapshot?.sync?.phase === "cleaning" ? "Cleaning…" : snapshot?.sync?.busy ? "Syncing…" : snapshot?.sync?.message.startsWith("Removed") ? `Cleanup ${formatClock(cleanupAt ?? now, snapshot.settings.clock24, true)}` : snapshot?.sync?.nextAt ? `Next in ${Math.max(0, Math.ceil((snapshot.sync.nextAt - now) / 1000))}s` : snapshot?.sync?.phase === "paused" ? "Sync paused" : "Stopped"}{snapshot?.sync?.lastAt && !snapshot.sync.message.startsWith("Removed") ? ` · Last ${formatClock(snapshot.sync.lastAt, snapshot.settings.clock24, true)}` : ""}</span><select aria-label="Auto-sync interval" value={snapshot?.settings.syncInterval ?? 60} onChange={e => void call("syncInterval", Number(e.currentTarget.value)).then(setSnapshot).catch(e => setMessage(e.message))}><option value="10">10 seconds</option><option value="20">20 seconds</option><option value="30">30 seconds</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="300">5 minutes</option></select><button disabled={!connected || !snapshot?.sharing?.configured || snapshot?.sync?.phase === "resetting"} onClick={() => void call("syncControl", snapshot?.sync?.running ? "stop" : "start").catch(e => setMessage(e.message))}>{snapshot?.sync?.running ? "Stop" : "Start"}</button><button disabled={!connected || !snapshot?.sharing?.configured || snapshot?.sync?.phase === "resetting"} onClick={() => action("sync")}>↻ Sync</button><button class="delete-outdated" disabled={!connected || snapshot?.sync?.phase === "resetting" || snapshot?.sync?.phase === "cleaning"} title="Delete all outdated local and shared entries; current observations are preserved" onClick={() => void call("pruneOutdated", null).catch(e => setMessage(e.message))}>{snapshot?.sync?.phase === "cleaning" ? "Cleaning…" : "Delete outdated"}</button></div></footer>
    <div class="bottomline">America/Sao_Paulo <span>UTC−3</span><span class="capture-identity">{health.identity.name ? `${health.identity.name} · ${health.identity.source === "live" ? "Live character" : health.identity.source === "cached" ? "Cached character" : "Manual name"}` : "Character not detected"}{health.region && health.channel ? ` · ${health.region.toUpperCase()} Ch${health.channel}` : ""}</span></div>
    <dialog ref={dialog} onCancel={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)} aria-labelledby="settings-title">
      <div class="settings-header"><div><span class="eyebrow">MVP TRACKER</span><h2 id="settings-title">Settings</h2></div><button aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button></div>
      <div class="settings-body"><nav aria-label="Settings sections">{(["General", "Tracking", "Sharing", "Capture & diagnostics"] as Tab[]).map(t => <button key={t} class={tab === t ? "selected" : ""} onClick={() => { setTab(t); setMessage(""); }}>{t}</button>)}</nav>
        <section class="settings-content">
          {tab === "General" && <><h3>Window & time</h3><label class="check-row"><input type="checkbox" checked={draft.startMinimized} onChange={e => setDraft({ ...draft, startMinimized: e.currentTarget.checked })}/><span>Start hidden in the system tray<small>Applies the next time you open MVP Tracker.</small></span></label>
            <label class="check-row"><input type="checkbox" checked={draft.clock24} onChange={e => setDraft({ ...draft, clock24: e.currentTarget.checked })}/><span>Use a 24-hour clock<small>24-hour time is the default. Turn this off to use AM/PM.</small></span></label>
            <label class="field">Time zone<select disabled><option>America/Sao_Paulo (UTC−3)</option></select><small>More time zones are planned for a later version.</small></label>
            <label class="field">Interface size<select value={draft.uiScale} onChange={e => setDraft({ ...draft, uiScale: Number(e.currentTarget.value) })}>{[80, 90, 100, 110, 125].map(scale => <option key={scale} value={scale}>{scale}%{scale === 100 ? " (default)" : ""}</option>)}</select><small>Save applies the size. Window position and dimensions are remembered automatically.</small></label>
            <h3>Global shortcuts</h3><p class="help">Click a field and press a shortcut. Backspace clears it. Registered shortcuts consume the key press, including while the game is focused.</p>
            {ACTIONS.map(a => <div class="hotkey-row" key={a}><label for={`key-${a}`}>{labels[a]}</label><input id={`key-${a}`} value={draft.hotkeys[a] || "Disabled"} readOnly onFocus={() => void call("hotkeyCapture", true).catch(() => setMessage("Could not pause shortcuts. Retry before recording a key."))} onBlur={() => void call("hotkeyCapture", false).catch(() => {})} aria-label={`${labels[a]} shortcut`} onKeyDown={e => {
              if (e.key === "Tab") return; e.preventDefault(); if (e.repeat || ["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
              const shortcut = e.key === "Backspace" || e.key === "Delete" ? "" : `${e.ctrlKey ? "Ctrl+" : ""}${e.altKey ? "Alt+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key.toUpperCase()}`;
              setDraft({ ...draft, hotkeys: { ...draft.hotkeys, [a]: shortcut } });
            }}/><button aria-label={`Disable ${labels[a]} shortcut`} onClick={() => setDraft({ ...draft, hotkeys: { ...draft.hotkeys, [a]: "" } })}>Clear</button>{snapshot?.hotkeyErrors[a] && <small class="hotkey-error">{snapshot.hotkeyErrors[a]}</small>}</div>)}
            <button class="link-button" onClick={() => setDraft({ ...draft, hotkeys: defaults().hotkeys })}>Restore F7 / F8 / F9</button><p class="help">Conflicts are shown after Save. F12 is reserved by Windows. F8 opens Add manually; F9 sync becomes available with Convex sharing.</p></>}
          {tab === "Tracking" && <><h3>Bosses to track</h3><div class="catalog-presets">{(["all", "endgame", "none"] as const).map(preset => <button onClick={() => setDraft({ ...draft, tracking: { ...draft.tracking, bossIds: bossPreset(preset) } })}>{preset === "all" ? "All" : preset === "endgame" ? "Endgame" : "None"}</button>)}<span>{draft.tracking.bossIds.length} / {BOSSES.length}</span></div>
            <div class="catalog-list"><table><thead><tr><th>Name</th><th>Level</th><th>Map</th><th>Track</th></tr></thead><tbody>{BOSSES.map(b => <tr key={b.id}><td>{b.name}</td><td>{b.level}</td><td>{b.map}</td><td><input aria-label={`Track ${b.name}`} type="checkbox" checked={draft.tracking.bossIds.includes(b.id)} onChange={e => setDraft({ ...draft, tracking: { ...draft.tracking, bossIds: e.currentTarget.checked ? [...draft.tracking.bossIds, b.id] : draft.tracking.bossIds.filter(id => id !== b.id) } })}/></td></tr>)}</tbody></table></div>
            <h3>Regions</h3><div class="region-checks">{REGIONS.map(region => <label><input type="checkbox" checked={draft.tracking.regions.includes(region)} onChange={e => setDraft({ ...draft, tracking: { ...draft.tracking, regions: e.currentTarget.checked ? [...draft.tracking.regions, region] : draft.tracking.regions.filter(r => r !== region) } })}/>{region.toUpperCase()}</label>)}</div><p class="help">Channels 1–3 are supported in every region. Save applies these preferences. Unchecking an option hides its existing timers; they remain stored until expiry.</p></>}
          {tab === "Sharing" && <SharingSettings draft={connectionDraft} onDraft={setConnectionDraft} saved={connectionSaved} sync={snapshot?.sync} status={snapshot?.sharing} character={health.identity.name ? `${health.identity.name} · ${health.identity.source === "live" ? "Live character" : health.identity.source === "cached" ? "Cached character" : "Manual name"}` : ""}/>}
          {tab === "Capture & diagnostics" && <><h3>Capture</h3><p role="status">{health.detail}</p>
            <label class="field">Network adapter<select value={draft.capture.deviceName} onChange={e => setDraft({ ...draft, capture: { ...draft.capture, deviceName: e.currentTarget.value } })}><option value="">Automatic (recommended)</option>{draft.capture.deviceName && !health.devices.some(d => d.name === draft.capture.deviceName) && <option value={draft.capture.deviceName}>Saved adapter · unavailable</option>}{health.devices.map(d => <option key={d.name} value={d.name}>{d.label}</option>)}</select><small>Save applies the adapter choice. Retry refreshes the adapter list.</small></label>
            <button disabled={!snapshot || health.state === "starting"} onClick={() => void retryCapture()}>Retry capture</button>
            <p class="help">Npcap is required for capture. Install it from npcap.com with WinPcap API-compatible mode enabled. It is not included in this portable app.</p>
            <h3>Character identity</h3><p>{health.character ? `${health.character} · detected live` : "Waiting for your local character. Move or change maps in the game."}</p>{!health.character && health.cachedCharacter && <p class="help">Last seen: {health.cachedCharacter} (cached for this session; not used as a live identity).</p>}
            <label class="field">Manual character name<input maxLength={80} value={draft.capture.manualCharacter} placeholder="Optional fallback for sharing" onInput={e => setDraft({ ...draft, capture: { ...draft.capture, manualCharacter: e.currentTarget.value } })}/><small>Used for sharing when neither a live nor a cached name is available. Live detection takes priority. This does not change the killer or original observer on a timer.</small></label>
            <h3>Application health</h3><dl><dt>Version</dt><dd>{VERSION} · Windows 11 x64</dd><dt>Backend</dt><dd>{snapshot ? "Connected" : "Unavailable"}</dd><dt>System tray</dt><dd>{snapshot?.trayReady ? "Ready" : "Unavailable"}</dd><dt>Portable storage</dt><dd>{snapshot?.storageWritable ? "Writable" : "Unavailable / read-only"}</dd><dt>Capture</dt><dd>{captureLabel} · {gameLabel}</dd><dt>Adapter in use</dt><dd>{health.adapter ?? "None"}</dd><dt>Last game packet</dt><dd>{health.lastPacketAt ? formatTimestamp(health.lastPacketAt, snapshot?.settings.clock24) : "None this capture session"}</dd><dt>Retry</dt><dd>{health.retryAt ? formatClock(health.retryAt, snapshot?.settings.clock24) : "Not scheduled"}</dd><dt>Awaiting context</dt><dd>{health.unresolved}</dd><dt>Skipped observations</dt><dd>{health.skipped}</dd></dl>
            <p class="help">Early graves wait up to 10 seconds for channel/region context on the same connection. Unresolved or inconsistent observations are then skipped. Once the game context is detected, revisit the gravestone to collect fresh evidence. A missing packet or object despawn never counts as proof of a boss respawn.</p>
            <h3>Essential logs only</h3><p class="help">Capture tools 3.0.2 · Character tools 0.6.1. Logs are stored in the logs folder beside the app. Up to five 2 MiB files are retained for seven days. Packet data, character names, credentials and clipboard contents are never logged.</p><div class="diagnostic-actions"><button onClick={() => void diagnosticsAction("open")}>Open logs</button><button onClick={() => void diagnosticsAction("copy")}>Copy diagnostics</button><button onClick={() => void diagnosticsAction("clear")}>Clear logs</button><button onClick={() => void diagnosticsAction(snapshot?.diagnosticsUntil && snapshot.diagnosticsUntil > now ? "stop" : "start")}>{snapshot?.diagnosticsUntil && snapshot.diagnosticsUntil > now ? "Stop health sampling" : "Sample health for 5 minutes"}</button></div><p class="help">Diagnostics includes versions, anonymous health counts and recent event codes. Sampling stops automatically and stays in memory until you copy it. Nothing is uploaded.</p><p class="help">Preferences live in data/settings.json beside the app. Extract the entire ZIP into a folder you can write to.</p></>}
        </section>
      </div>
      <div class="settings-footer"><button class="exit" onClick={() => void shell("exit")}>Exit MVP Tracker</button><span role="status">{message}</span><button class="primary" disabled={saving || !snapshot?.storageWritable} onClick={() => void save()}>{saving ? "Saving…" : "Save settings"}</button></div>
    </dialog>
    {manual && snapshot && <ManualDialog snapshot={snapshot} edit={manual.edit} onClose={() => setManual(null)} onSaved={(value, text) => { setSnapshot(value); setMessage(text); }}/>}
    {importing && <ImportDialog onClose={() => setImporting(false)} onSaved={(value, text) => { setSnapshot(value); setMessage(text); }}/>}
  </main>;
}
render(<App/>, document.getElementById("app")!);
