import { useEffect, useRef, useState } from "preact/hooks";
import { call } from "./bridge";
import type { Connection, ConnectionStatus, Dataset } from "../shared/sharing";
import type { SyncStatus } from "../backend/sync-coordinator";
export function SharingSettings({ status, character, draft, onDraft, saved, sync }: {
  status?: ConnectionStatus; character: string; draft: Connection | null; onDraft: (value: Connection) => void; saved: Connection | null; sync?: SyncStatus;
}) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [reset, setReset] = useState<Dataset | null>(null), dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (reset) dialog.current?.showModal(); else dialog.current?.close(); }, [reset]);
  const dirty = !draft || !saved || draft.url.trim().replace(/\/$/, "") !== saved.url;
  const dataset = sync?.dataset ?? status?.dataset;
  const test = async () => {
    setBusy(true); setMessage("");
    try { setMessage((await call("sharingTest", null)).message); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const confirmReset = async () => {
    if (!reset) return; setBusy(true);
    try { setMessage((await call("sharingReset", reset)).message); setReset(null); }
    catch (e) { setMessage((e as Error).message); setReset(null); } finally { setBusy(false); }
  };
  return <><h3>Connect your group</h3><p class="help">Enter your group's Convex URL and click Save settings below. Leave it empty to disconnect. No key, account or environment file is needed in the app.</p>
    <label class="field">Convex URL<input value={draft?.url ?? ""} disabled={busy || !draft} placeholder="https://your-deployment.convex.cloud" maxLength={200} autoComplete="off" onInput={e => onDraft({ url: e.currentTarget.value })}/></label>
    <div class="diagnostic-actions"><button disabled={busy || dirty || !status?.configured || status.state === "testing"} onClick={() => void test()}>{status?.state === "testing" ? "Checking…" : "Test connection"}</button><button class="exit" disabled={busy || dirty || !dataset || sync?.phase === "resetting"} onClick={() => setReset(dataset!)}>Reset database…</button></div>
    <p role="status" class="help">{dirty ? "Save settings to use this URL." : status?.message}{message && <><br/>{message}</>}</p>
    <p class="help">Test checks the deployed tracker without changing its data. Reset clears all MVP Tracker observations for everyone and restores tracker metadata; automatic sync stops. The owner must install updated schema/functions with npx convex dev --once before using a new backend version. Reset cannot deploy code or alter unrelated tables.</p>
    <h3>Sharing as</h3><p>{character || "Anonymous (no character detected)"}</p><p class="help">Live character takes priority, then cached, then your manual fallback. A character name is optional.</p>
    <h3>Automatic sync</h3><p class="help">Use Start/Stop and the interval in the tracker footer. Manual Sync and F9 remain available while automatic sync runs. The app always restarts stopped. Anyone with this deployment URL can read, sync and reset the tracker.</p>
    <dialog ref={dialog} onCancel={e => { if (busy) e.preventDefault(); else setReset(null); }} aria-labelledby="reset-title"><div class="manual-content"><h2 id="reset-title">Reset database?</h2><p>This permanently clears all shared MVP Tracker observations from every player and restores tracker metadata. Auto-sync will stop.</p><p class="help">{status?.url}<br/>Dataset: {reset?.datasetId}<br/>Generation: {reset?.generation}</p><div class="diagnostic-actions"><button disabled={busy} onClick={() => setReset(null)}>Cancel</button><button class="exit" disabled={busy} onClick={() => void confirmReset()}>{busy ? "Resetting…" : "Reset database"}</button></div></div></dialog>
  </>;
}
