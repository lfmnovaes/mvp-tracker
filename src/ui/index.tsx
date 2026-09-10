import { render } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { ACTIONS, VERSION, defaults, parseSettings, type Action, type Settings, type Snapshot } from "../shared/protocol";
import { call, connect, emergencyExit, subscribe } from "./bridge";
import { BOSSES, REGIONS, bossPreset, defaultSelection } from "../domain/catalog";
import { defaultSort, queryTimers, STATUS_LABELS, type SortField } from "../domain/query";
import { formatClock, formatTimestamp, ELIGIBLE_AFTER, SPAWN_AFTER } from "../domain/time";
import { slotKey } from "../domain/timers";

const labels: Record<Action, string> = { toggle: "Show / hide tracker", add: "Add manually", sync: "Sync" };
type Tab = "General" | "Tracking" | "Sharing" | "Capture & diagnostics";
function App() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("General");
  const [draft, setDraft] = useState<Settings>(defaults());
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState(Date.now());
  const [sorting, setSorting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const openSettings = () => { setDraft(snapshot?.settings ?? defaults()); setSettingsOpen(true); setMessage(""); };
  const action = (name: "add" | "sync") => setMessage(name === "add" ? "The manual-entry dialog is not available in this build yet." : "Sharing is not available in this build yet.");
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, []);
  useEffect(() => {
    let disposed = false;
    const off = subscribe(update => {
      if (update.type === "snapshot") { setSnapshot(update.value); setError(""); }
      else if (update.type === "settings") { setSettingsOpen(true); setMessage(""); }
      else if (update.type === "add" || update.type === "sync") action(update.type);
    });
    void (async () => {
      try {
        await connect();
        for (let i = 0; i < 12 && !disposed; i++) {
          try { const value = await call("snapshot", null); if (!disposed) { setSnapshot(value); setDraft(value.settings); setError(""); } return; }
          catch (e) { if (i === 11) throw e; await new Promise(r => setTimeout(r, 500)); }
        }
      } catch { if (!disposed) setError("MVP Tracker could not start its backend. Try restarting the app. Check that the portable ZIP was fully extracted."); }
    })();
    return () => { disposed = true; off(); };
  }, []);
  useEffect(() => {
    if (settingsOpen) { setDraft(snapshot?.settings ?? defaults()); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [settingsOpen]);
  const shell = async (command: "hide" | "minimize" | "exit") => {
    try { if (!snapshot && command === "exit") await emergencyExit(); else await call("shell", command); }
    catch (e) { if (command === "exit") await emergencyExit(); else setError((e as Error).message); }
  };
  const save = async () => {
    setSaving(true); setMessage("");
    try { const checked = parseSettings(draft); setSnapshot(await call("saveSettings", checked)); setMessage("Settings saved."); }
    catch (e) { setMessage((e as Error).message); }
    finally { setSaving(false); }
  };
  const selection = snapshot?.settings.tracking ?? defaultSelection();
  const sort = snapshot?.settings.sort ?? defaultSort();
  const rows = queryTimers(snapshot?.timers ?? [], selection, now, { search, sort });
  const noneSelected = selection.bossIds.length === 0 || selection.regions.length === 0;
  const changeSort = async (field: SortField) => {
    if (!snapshot || sorting) return; setSorting(true);
    try { setSnapshot(await call("saveSettings", { ...snapshot.settings, sort: { field, direction: sort.field === field && sort.direction === "asc" ? "desc" : "asc" } })); }
    catch (e) { setError((e as Error).message); } finally { setSorting(false); }
  };
  return <main>
    <header class="titlebar">
      <div id="drag-region" class="brand"><img src="/icon.png" alt=""/><strong>MVP <span>TRACKER</span></strong><small>SPIRIT VALE</small></div>
      <div class="window-actions"><button aria-label="Settings" title="Settings" onClick={openSettings}>⚙</button><button aria-label="Minimize" title="Minimize to taskbar" onClick={() => void shell("minimize")}>−</button><button class="close" aria-label="Hide to tray" title="Hide to tray · keeps running" onClick={() => void shell("hide")}>×</button></div>
    </header>
    <section class="health" aria-label="Capture status"><span class="status-dot"/><strong>Capture inactive</strong><span class="divider"/><span>Game detection unavailable</span><span class="health-right">{snapshot ? "Shell ready" : "Starting…"}</span></section>
    <div class="workspace">
      {(error || snapshot?.warning) && <div class="notice warning" role="alert">{error || snapshot?.warning}{error && <button onClick={() => void shell("exit")}>Exit app</button>}</div>}
      <section class="tracker-card" aria-label="Boss timers">
        <div class="table-toolbar"><div class="search-wrap"><span>⌕</span><input aria-label="Search bosses" placeholder="Search boss, map, region or channel" value={search} onInput={e => setSearch(e.currentTarget.value)} maxLength={200}/></div><span class="count">{rows.length} tracked</span><button class="primary" onClick={() => action("add")}>＋ Add manually</button></div>
        <div class="table-scroll"><table><thead><tr>{([["boss", "Boss"], ["level", "Level"], ["location", "Location"], ["region", "Region"], ["channel", "Channel"], ["status", "Status"], ["gathered", "Gathered at"], ["killer", "Killer"]] as [SortField, string][]).map(([field, label]) => <th key={field} aria-sort={sort.field === field ? sort.direction === "asc" ? "ascending" : "descending" : "none"}><button disabled={sorting || !snapshot} onClick={() => void changeSort(field)}>{label}{sort.field === field ? sort.direction === "asc" ? " ↑" : " ↓" : ""}</button></th>)}</tr></thead>
          <tbody>{rows.map(({ slot, boss, status }) => {
            const o = status === "outdated" ? undefined : slot.observation;
            return <tr key={slotKey(slot)}><td>{boss.name}</td><td>{boss.level}</td><td>{boss.map}</td><td>{slot.region.toUpperCase()}</td><td>{slot.channel}</td><td><span class={`timer-status ${status}`}>{STATUS_LABELS[status]}</span>{o && <small class="spawn-range">{formatClock(o.diedAt + ELIGIBLE_AFTER, snapshot?.settings.clock24)} – {formatClock(o.diedAt + SPAWN_AFTER, snapshot?.settings.clock24)}</small>}</td><td title={o ? `Kill: ${formatTimestamp(o.diedAt, snapshot?.settings.clock24)} · ${o.source}` : undefined}>{o ? formatTimestamp(o.gatheredAt, snapshot?.settings.clock24) : ""}</td><td>{o?.killedBy ?? ""}</td></tr>;
          })}</tbody></table></div>
        {rows.length === 0 && <div class="empty"><div class="empty-icon">◷</div><h2>{noneSelected ? "Nothing selected for tracking" : snapshot?.timers.length ? "No matching timers" : "No boss observations yet"}</h2><p>{noneSelected ? "Choose bosses and regions in Settings to start tracking." : snapshot?.timers.length ? "Try another boss name, region or channel." : "Your boss preferences are ready. Capture and manual entry are coming next."}</p><span class="empty-tag">MVP TRACKER · v{VERSION}</span></div>}
        <div class="table-note">Times will use America/Sao_Paulo <span>UTC−3</span></div>
      </section>
      <footer class="footer"><div class="exchange"><select aria-label="Export format" disabled><option>Text</option><option>JSON</option><option>Compressed</option></select><button disabled>Export</button><button disabled>Import</button></div><div class="sync"><span class="subtle">Auto-sync stopped</span><select aria-label="Auto-sync interval" disabled value="60"><option value="10">10 seconds</option><option value="20">20 seconds</option><option value="30">30 seconds</option><option value="60">1 minute</option><option value="120">2 minutes</option><option value="300">5 minutes</option></select><button disabled>Start</button><button onClick={() => action("sync")}>↻ Sync</button></div></footer>
      {message && !settingsOpen && <div class="notice" role="status">{message}<button aria-label="Dismiss message" onClick={() => setMessage("")}>×</button></div>}
    </div>
    <div class="bottomline"><span>{snapshot?.trayReady ? "Running in tray when closed" : "Tray starting or unavailable"}</span><span>WINDOWS · PORTABLE</span></div>
    <dialog ref={dialog} onCancel={() => setSettingsOpen(false)} onClose={() => setSettingsOpen(false)} aria-labelledby="settings-title">
      <div class="settings-header"><div><span class="eyebrow">MVP TRACKER</span><h2 id="settings-title">Settings</h2></div><button aria-label="Close settings" onClick={() => setSettingsOpen(false)}>×</button></div>
      <div class="settings-body"><nav aria-label="Settings sections">{(["General", "Tracking", "Sharing", "Capture & diagnostics"] as Tab[]).map(t => <button key={t} class={tab === t ? "selected" : ""} onClick={() => { setTab(t); setMessage(""); }}>{t}</button>)}</nav>
        <section class="settings-content">
          {tab === "General" && <><h3>Window & time</h3><label class="check-row"><input type="checkbox" checked={draft.startMinimized} onChange={e => setDraft({ ...draft, startMinimized: e.currentTarget.checked })}/><span>Start hidden in the system tray<small>Applies the next time you open MVP Tracker.</small></span></label>
            <label class="check-row"><input type="checkbox" checked={draft.clock24} onChange={e => setDraft({ ...draft, clock24: e.currentTarget.checked })}/><span>Use a 24-hour clock<small>AM/PM is the default for timer entry and display.</small></span></label>
            <label class="field">Time zone<select disabled><option>America/Sao_Paulo (UTC−3)</option></select><small>More time zones are planned for a later version.</small></label>
            <h3>Global shortcuts</h3><p class="help">Click a field and press a shortcut. Backspace clears it. Registered shortcuts consume the key press, including while the game is focused.</p>
            {ACTIONS.map(a => <div class="hotkey-row" key={a}><label for={`key-${a}`}>{labels[a]}</label><input id={`key-${a}`} value={draft.hotkeys[a] || "Disabled"} readOnly onFocus={() => void call("hotkeyCapture", true).catch(() => setMessage("Could not pause shortcuts. Retry before recording a key."))} onBlur={() => void call("hotkeyCapture", false).catch(() => {})} aria-label={`${labels[a]} shortcut`} onKeyDown={e => {
              if (e.key === "Tab") return; e.preventDefault(); if (e.repeat || ["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
              const shortcut = e.key === "Backspace" || e.key === "Delete" ? "" : `${e.ctrlKey ? "Ctrl+" : ""}${e.altKey ? "Alt+" : ""}${e.shiftKey ? "Shift+" : ""}${e.key.toUpperCase()}`;
              setDraft({ ...draft, hotkeys: { ...draft.hotkeys, [a]: shortcut } });
            }}/><button aria-label={`Disable ${labels[a]} shortcut`} onClick={() => setDraft({ ...draft, hotkeys: { ...draft.hotkeys, [a]: "" } })}>Clear</button>{snapshot?.hotkeyErrors[a] && <small class="hotkey-error">{snapshot.hotkeyErrors[a]}</small>}</div>)}
            <button class="link-button" onClick={() => setDraft({ ...draft, hotkeys: defaults().hotkeys })}>Restore F7 / F8 / F9</button><p class="help">Conflicts are shown after Save. F12 is reserved by Windows. Add and Sync become functional in later implementation steps.</p></>}
          {tab === "Tracking" && <><h3>Bosses to track</h3><div class="catalog-presets">{(["all", "endgame", "none"] as const).map(preset => <button onClick={() => setDraft({ ...draft, tracking: { ...draft.tracking, bossIds: bossPreset(preset) } })}>{preset === "all" ? "All" : preset === "endgame" ? "Endgame" : "None"}</button>)}<span>{draft.tracking.bossIds.length} / {BOSSES.length}</span></div>
            <div class="catalog-list"><table><thead><tr><th>Name</th><th>Level</th><th>Map</th><th>Track</th></tr></thead><tbody>{BOSSES.map(b => <tr key={b.id}><td>{b.name}</td><td>{b.level}</td><td>{b.map}</td><td><input aria-label={`Track ${b.name}`} type="checkbox" checked={draft.tracking.bossIds.includes(b.id)} onChange={e => setDraft({ ...draft, tracking: { ...draft.tracking, bossIds: e.currentTarget.checked ? [...draft.tracking.bossIds, b.id] : draft.tracking.bossIds.filter(id => id !== b.id) } })}/></td></tr>)}</tbody></table></div>
            <h3>Regions</h3><div class="region-checks">{REGIONS.map(region => <label><input type="checkbox" checked={draft.tracking.regions.includes(region)} onChange={e => setDraft({ ...draft, tracking: { ...draft.tracking, regions: e.currentTarget.checked ? [...draft.tracking.regions, region] : draft.tracking.regions.filter(r => r !== region) } })}/>{region.toUpperCase()}</label>)}</div><p class="help">Channels 1–3 are supported in every region. Save applies these preferences. Unchecking an option hides its existing timers; they remain stored until expiry.</p></>}
          {tab === "Sharing" && <><h3>Your group, in sync</h3><p>Convex sharing arrives in Steps 6–7.</p><label class="field">Convex URL<input placeholder="https://your-deployment.convex.cloud" disabled/></label><label class="field">Shared group key<input type="password" placeholder="Not configured" disabled/></label><p class="help">Optional auto-sync: 10s, 20s, 30s, 1m, 2m or 5m. Clipboard exchange comes in Step 5.</p></>}
          {tab === "Capture & diagnostics" && <><h3>Application health</h3><dl><dt>Version</dt><dd>{VERSION} · Windows 11 x64</dd><dt>Backend</dt><dd>{snapshot ? "Connected" : "Unavailable"}</dd><dt>System tray</dt><dd>{snapshot?.trayReady ? "Ready" : "Unavailable"}</dd><dt>Portable storage</dt><dd>{snapshot?.storageWritable ? "Writable" : "Unavailable / read-only"}</dd><dt>Capture</dt><dd>Not installed in this shell build</dd></dl><h3>Essential logs only</h3><p class="help">Logs are stored in the logs folder beside the app. Up to five 2 MiB files are retained for seven days. Packet data, character names, credentials and clipboard contents are never logged.</p><p class="help">Preferences live in data/settings.json beside the app. Extract the entire ZIP into a folder you can write to.</p></>}
        </section>
      </div>
      <div class="settings-footer"><button class="exit" onClick={() => void shell("exit")}>Exit MVP Tracker</button><span role="status">{message}</span><button class="primary" disabled={saving || !snapshot?.storageWritable} onClick={() => void save()}>{saving ? "Saving…" : "Save settings"}</button></div>
    </dialog>
  </main>;
}
render(<App/>, document.getElementById("app")!);
