import { useEffect, useRef, useState } from "preact/hooks";
import { call } from "./bridge";
import type { Connection, ConnectionStatus, Dataset } from "../shared/sharing";
import type { SyncStatus } from "../backend/sync-coordinator";
export function SharingSettings({ status, character, draft, onDraft, saved, onSaved, sync }: {
  status?: ConnectionStatus; character: string; draft: Connection | null; onDraft: (value: Connection) => void; saved: Connection | null; onSaved: (value: Connection) => void; sync?: SyncStatus;
}) {
  const [reveal, setReveal] = useState(false), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [reset, setReset] = useState<Dataset | null>(null), dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (reset) dialog.current?.showModal(); else dialog.current?.close(); }, [reset]);
  const dirty = !draft || !saved || draft.url !== saved.url || draft.groupKey !== saved.groupKey;
  const save = async (value = draft) => {
    if (!value) return; setBusy(true); setMessage("");
    try { await call("sharingSave", value); const next = await call("sharingRead", null); onDraft(next); onSaved(next); setMessage(value.url ? "Connection saved." : "Connection removed. Local timers are preserved."); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setMessage("");
    try { setMessage((await call("sharingTest", null)).message); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const confirmReset = async () => {
    if (!reset) return; setBusy(true);
    try { setMessage((await call("sharingReset", reset)).message); setReset(null); }
    catch (e) { setMessage((e as Error).message); setReset(null); } finally { setBusy(false); }
  };
  return <><h3>Connect your group</h3><p class="help">Save connection or the bottom Save settings button stores these fields. Saving checks setup without uploading timers. A new Convex deployment needs the MVP Tracker functions deployed once from the source repository.</p>
    <label class="field">Convex URL<input value={draft?.url ?? ""} disabled={busy || !draft} placeholder="https://your-deployment.convex.cloud" maxLength={200} autoComplete="off" onInput={e => onDraft({ ...draft!, url: e.currentTarget.value })}/></label>
    <label class="field">Shared group key (optional)<input type={reveal ? "text" : "password"} value={draft?.groupKey ?? ""} disabled={busy || !draft} placeholder="Leave empty for URL-only access" maxLength={128} autoComplete="off" spellcheck={false} onInput={e => onDraft({ ...draft!, groupKey: e.currentTarget.value })}/></label>
    <label class="check-row"><input type="checkbox" checked={reveal} onChange={e => setReveal(e.currentTarget.checked)}/><span>Show group key</span></label>
    <div class="diagnostic-actions"><button class="primary" disabled={busy || !dirty || !draft} onClick={() => void save()}>Save connection</button><button disabled={busy || dirty || !status?.configured || status.state === "testing"} onClick={() => void test()}>{status?.state === "testing" ? "Checking…" : "Test connection"}</button><button disabled={busy || !draft || !status?.configured} onClick={() => void save({ url: "", groupKey: "" })}>Remove connection</button></div>
    <p role="status" class="help">{status?.message}{message && <><br/>{message}</>}</p>
    <h3>Sharing as</h3><p>{character || "Anonymous (no character detected)"}</p><p class="help">Live character takes priority, then cached, then your manual fallback. Unknown names upload as null.</p>
    <h3>Automatic sync</h3><p class="help">Use Start/Stop and the interval in the tracker footer. Manual Sync and F9 remain available while automatic sync runs. The app always restarts stopped. Continuous 10-second sync uses about 259,200 calls per month per player; 1 minute uses about 43,200, before retries and cleanup.</p>
    <h3>Reset shared timers</h3><p class="help">Reset clears this group's timers for everyone and leaves automatic sync stopped. Run Sync once to load the current dataset before resetting.</p><button class="exit" disabled={busy || dirty || !sync?.dataset || sync.phase === "resetting"} onClick={() => setReset(sync!.dataset!)}>Reset shared timers…</button>
    <p class="help">Without MVP_GROUP_KEY on the deployment, anyone with its URL can read, upload and reset. Configuring a key on the server requires every player to provide it. The local key file is excluded from timer exports, diagnostics and packages.</p>
    <dialog ref={dialog} onCancel={e => { if (busy) e.preventDefault(); else setReset(null); }} aria-labelledby="reset-title"><div class="manual-content"><h2 id="reset-title">Reset this group's timers?</h2><p>This clears shared timers from every player.</p><p class="help">{status?.url}<br/>Dataset: {reset?.datasetId}<br/>Generation: {reset?.generation}</p><div class="diagnostic-actions"><button disabled={busy} onClick={() => setReset(null)}>Cancel</button><button class="exit" disabled={busy} onClick={() => void confirmReset()}>{busy ? "Resetting…" : "Clear shared timers"}</button></div></div></dialog>
  </>;
}
