import { useEffect, useRef, useState } from "preact/hooks";
import { EXCHANGE_LIMIT, type ImportSummary } from "../shared/exchange";
import type { Snapshot } from "../shared/protocol";
import { call } from "./bridge";
export function ImportDialog({ onClose, onSaved }: { onClose: () => void; onSaved: (snapshot: Snapshot, message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(""), [error, setError] = useState("");
  const [busy, setBusy] = useState(false), [preview, setPreview] = useState<ImportSummary | null>(null);
  useEffect(() => { const element = dialog.current; element?.showModal(); return () => element?.close(); }, []);
  const close = () => { dialog.current?.close(); onClose(); };
  const submit = async (commit: boolean) => {
    if (busy || !text.trim() || commit && !preview) return;
    setBusy(true); setError("");
    try {
      const result = await call("importTimers", { text, commit });
      if (commit && result.snapshot) { onSaved(result.snapshot, `Import merged: ${result.summary.added} added, ${result.summary.refreshed} refreshed, ${result.summary.ignored + result.summary.disabled + result.summary.expired} skipped.`); close(); }
      else setPreview(result.summary);
    } catch (e) { setError((e as Error).message); setPreview(null); }
    finally { setBusy(false); }
  };
  return <dialog ref={dialog} class="import-dialog" aria-labelledby="import-title" onCancel={e => { e.preventDefault(); if (!busy) close(); }}>
    <form onSubmit={e => { e.preventDefault(); void submit(!!preview); }}>
      <div class="settings-header"><h2 id="import-title">Import timers</h2><button type="button" disabled={busy} aria-label="Close import" onClick={close}>×</button></div>
      <div class="manual-content"><p>Paste MVP Tracker JSON or an MVPT1 compressed string. Compact text cannot be imported.</p>
        <label class="field">Timer data<textarea autoFocus rows={9} required maxLength={EXCHANGE_LIMIT} disabled={busy} value={text} onInput={e => { setText(e.currentTarget.value); setPreview(null); setError(""); }}/></label>
        {preview && <div class="kill-preview" role="status"><p>{preview.total} records validated</p><dl><dt>New slots</dt><dd>{preview.added}</dd><dt>Refreshed</dt><dd>{preview.refreshed}</dd><dt>Older / duplicates</dt><dd>{preview.ignored}</dd><dt>Not selected</dt><dd>{preview.disabled}</dd><dt>Expired</dt><dd>{preview.expired}</dd><dt>Equal-time conflicts</dt><dd>{preview.conflicted} (resolved by observation ID)</dd></dl><p>Confirmation checks the latest local evidence again. Original kill and gathered times are preserved.</p></div>}
        {error && <p role="alert" class="form-error">{error}</p>}
      </div><div class="settings-footer"><button type="button" disabled={busy} onClick={close}>Cancel</button><span/><button type="submit" class="primary" disabled={busy || !text.trim()}>{busy ? "Checking…" : preview ? "Merge timers" : "Preview import"}</button></div>
    </form>
  </dialog>;
}
