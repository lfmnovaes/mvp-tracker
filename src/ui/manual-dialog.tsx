import { useEffect, useRef, useState } from "preact/hooks";
import type { Snapshot } from "../shared/protocol";
import { manualBosses, manualDraft } from "../domain/manual";
import { bossById, CHANNELS } from "../domain/catalog";
import { slotKey, type ManualEntry, type TimerSlot } from "../domain/timers";
import { dateInZone, ELIGIBLE_AFTER, EXPIRE_AFTER, formatTimestamp, parseManualTime, SPAWN_AFTER } from "../domain/time";
import { call } from "./bridge";

export function ManualDialog({ snapshot, edit, onClose, onSaved }: { snapshot: Snapshot; edit?: TimerSlot; onClose: () => void; onSaved: (s: Snapshot, text: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [entry, setEntry] = useState<ManualEntry | undefined>(() => manualDraft(snapshot.settings.tracking, snapshot.settings.clock24, Date.now(), edit));
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const element = dialog.current; element?.showModal(); const tick = setInterval(() => setNow(Date.now()), 1000); return () => { clearInterval(tick); element?.close(); }; }, []);
  const close = () => { dialog.current?.close(); onClose(); };
  const update = (patch: Partial<ManualEntry>) => { if (entry) setEntry({ ...entry, ...patch }); setError(""); };
  const bosses = manualBosses(snapshot.settings.tracking);
  let validation = "", diedAt: number | undefined;
  if (entry) { try { diedAt = parseManualTime(entry, now).diedAt; } catch (e) { validation = (e as Error).message; } }
  const selected = entry && snapshot.settings.tracking.bossIds.includes(entry.mobId) && snapshot.settings.tracking.regions.includes(entry.region);
  const save = async (event: SubmitEvent) => {
    event.preventDefault(); if (!entry || saving || validation || !selected) return;
    setSaving(true); setError("");
    try {
      const result = await call("saveManual", { mode: edit ? "edit" : "add", originalSlot: edit, entry });
      const saved = result.timers.find(slot => slotKey(slot) === slotKey(entry));
      onSaved(result, saved?.outdated ? "Saved as Outdated. The expired kill information was discarded." : "Timer saved. Gathered time was set when you confirmed.");
      close();
    } catch (e) { setError((e as Error).message); setSaving(false); }
  };
  return <dialog ref={dialog} class="manual-dialog" aria-labelledby="manual-title" onCancel={e => { e.preventDefault(); if (!saving) close(); }}>
    <form onSubmit={e => void save(e)}>
      <div class="settings-header"><h2 id="manual-title">{edit ? "Edit timer" : "Add manually"}</h2><button type="button" aria-label="Close timer dialog" disabled={saving} onClick={close}>×</button></div>
      <div class="manual-content">
        {!entry ? <p>Select at least one boss and region in Settings before adding a timer.</p> : <>
          <fieldset disabled={saving}><div class="manual-grid">
            <label class="field wide">Boss<select autoFocus={!edit} disabled={!!edit} value={entry.mobId} onChange={e => update({ mobId: e.currentTarget.value as ManualEntry["mobId"] })}>{edit ? <option value={entry.mobId}>{bossById(entry.mobId)?.name}</option> : bosses.map(b => <option key={b.id} value={b.id}>{b.name} · Lv {b.level}</option>)}</select></label>
            <label class="field">Region<select disabled={!!edit} value={entry.region} onChange={e => update({ region: e.currentTarget.value as ManualEntry["region"] })}>{(edit ? [entry.region] : snapshot.settings.tracking.regions).map(r => <option key={r} value={r}>{r.toUpperCase()}</option>)}</select></label>
            <label class="field">Channel<select disabled={!!edit} value={entry.channel} onChange={e => update({ channel: Number(e.currentTarget.value) as ManualEntry["channel"] })}>{CHANNELS.map(ch => <option key={ch} value={ch}>{ch}</option>)}</select></label>
            <label class="field wide">Kill date<input autoFocus={!!edit} type="date" required value={entry.date} min="2000-01-01" max={dateInZone(now)} onInput={e => update({ date: e.currentTarget.value })}/><span class="date-shortcuts"><button type="button" onClick={() => update({ date: dateInZone(Date.now()) })}>Today</button><button type="button" onClick={() => update({ date: dateInZone(Date.now() - 86400000) })}>Yesterday</button></span></label>
            <label class={`field ${entry.clock24 ? "wide" : ""}`}>Kill time ({entry.clock24 ? "24-hour" : "12-hour"})<input type="text" inputMode="text" required maxLength={8} placeholder={entry.clock24 ? "21:35 or 21:35:22" : "9:35 or 9:35:22"} value={entry.time} onInput={e => update({ time: e.currentTarget.value })} aria-describedby="kill-preview"/></label>
            {!entry.clock24 && <label class="field">AM / PM<select value={entry.meridiem} onChange={e => update({ meridiem: e.currentTarget.value as "AM" | "PM" })}><option>AM</option><option>PM</option></select></label>}
            <label class="field wide">Killer (optional)<input maxLength={80} value={entry.killedBy ?? ""} onInput={e => update({ killedBy: e.currentTarget.value })}/></label>
          </div></fieldset>
          <div id="kill-preview" class="kill-preview">{diedAt !== undefined ? <><p>Kill: <strong>{formatTimestamp(diedAt, entry.clock24)}</strong></p><p>Spawn window: {formatTimestamp(diedAt + ELIGIBLE_AFTER, entry.clock24)} – {formatTimestamp(diedAt + SPAWN_AFTER, entry.clock24)}</p>{now >= diedAt + EXPIRE_AFTER && <p class="outdated-hint">This kill is over 150 minutes old. Saving clears the slot to Outdated.</p>}</> : <p>{validation}</p>}<small>America/Sao_Paulo · UTC−3. Gathered time is set automatically on Save.</small></div>
          {!selected && <p role="alert">This boss or region is no longer selected in Settings.</p>}
        </>}
        {error && <p class="form-error" role="alert">{error}</p>}
      </div>
      <div class="settings-footer"><button type="button" disabled={saving} onClick={close}>Cancel</button><span/><button class="primary" type="submit" disabled={saving || !entry || !!validation || !selected}>{saving ? "Saving…" : edit ? "Save changes" : "Save timer"}</button></div>
    </form>
  </dialog>;
}
