import { useEffect, useState } from "preact/hooks";
import { call } from "./bridge";
import type { Connection, ConnectionStatus } from "../shared/sharing";
export function SharingSettings({ status, character }: { status?: ConnectionStatus; character: string }) {
  const [draft, setDraft] = useState<Connection>({ url: "", groupKey: "" });
  const [saved, setSaved] = useState<Connection | null>(null);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    let disposed = false;
    void call("sharingRead", null).then(value => { if (!disposed) { setDraft(value); setSaved(value); } }).catch(() => { if (!disposed) setMessage("Could not load the saved connection. Reopen Settings to retry."); });
    return () => { disposed = true; };
  }, []);
  const dirty = !saved || draft.url !== saved.url || draft.groupKey !== saved.groupKey;
  const save = async (value = draft) => {
    setBusy(true); setMessage("");
    try { await call("sharingSave", value); const next = await call("sharingRead", null); setDraft(next); setSaved(next); setMessage(value.url ? "Connection saved. Test it next." : "Connection removed. Local timers are preserved."); }
    catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setMessage("");
    try { const result = await call("sharingTest", null); setMessage(result.message); } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  };
  return <><h3>Connect your private group</h3><p class="help">Use the cloud development deployment prepared by your group owner. Connection changes are saved separately from General settings.</p>
    <label class="field">Convex URL<input value={draft.url} disabled={busy || !saved} placeholder="https://your-deployment.convex.cloud" maxLength={200} autoComplete="off" onInput={e => setDraft({ ...draft, url: e.currentTarget.value })}/></label>
    <label class="field">Shared group key<input type={reveal ? "text" : "password"} value={draft.groupKey} disabled={busy || !saved} placeholder="Provided by your group owner" maxLength={128} autoComplete="off" spellcheck={false} onInput={e => setDraft({ ...draft, groupKey: e.currentTarget.value })}/></label>
    <label class="check-row"><input type="checkbox" checked={reveal} onChange={e => setReveal(e.currentTarget.checked)}/><span>Show group key</span></label>
    <div class="diagnostic-actions"><button class="primary" disabled={busy || !dirty || !saved} onClick={() => void save()}>Save connection</button><button disabled={busy || dirty || !status?.configured} onClick={() => void test()}>{status?.state === "testing" ? "Testing…" : "Test connection"}</button><button disabled={busy || !saved || !status?.configured} onClick={() => void save({ url: "", groupKey: "" })}>Remove connection</button></div>
    <p role="status" class="help">{message || status?.message || "Sharing is not configured."}</p>
    <h3>Sharing as</h3><p>{character || "Character name needed to upload"}</p><p class="help">Live character takes priority, then the cached name, then your manual fallback in Capture & diagnostics. Without a name, sharing will be download-only.</p>
    <p class="help">Manual/automatic syncing and confirmed dataset Reset arrive in Step 7. This version can save and test the connection without changing database entries.</p>
    <p class="help">The group key is stored in data/sharing-secrets.json beside the app. Anyone with a copy can access or reset the group database. It is excluded from timer exports, diagnostics and release packages.</p></>;
}
