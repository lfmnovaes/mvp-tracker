import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { STATUS_LABELS, type TimerRow } from "../domain/query";
import { formatClock, formatTimestamp, ELIGIBLE_AFTER, SPAWN_AFTER } from "../domain/time";
import type { TimerSlot } from "../domain/timers";
import { FRESHNESS_COLORS, freshnessBand, rowRevision } from "./timer-presentation";
export function TimerRowView({ row: { slot, boss, status }, now, clock24, onEdit, onRemove }: { row: TimerRow; now: number; clock24: boolean; onEdit: (slot: TimerSlot) => void; onRemove: (slot: TimerSlot) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [removing, setRemoving] = useState(false);
  const remove = async () => { if (removing) return; setRemoving(true); try { await onRemove(slot); } finally { setRemoving(false); } };
  const o = status === "outdated" ? undefined : slot.observation;
  const id = `details-${slot.mobId}-${slot.region}-${slot.channel}`;
  const element = useRef<HTMLTableRowElement>(null);
  const revision = rowRevision(slot, status);
  useLayoutEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = element.current?.animate([
      { opacity: 1, backgroundColor: "#304438", offset: 0 },
      { opacity: reduced ? 1 : .55, backgroundColor: "#304438", offset: .08 },
      { opacity: 1, backgroundColor: "#24352f", offset: .35 },
      { opacity: 1, backgroundColor: "#151e2a", offset: 1 },
    ], { duration: 2000, easing: "ease-out" });
    return () => animation?.cancel();
  }, [revision]);
  return <><tr ref={element}><td>{boss.name}</td><td>{boss.level}</td><td>{boss.map}</td><td>{slot.region.toUpperCase()}</td><td>{slot.channel}</td>
    <td><span class={`timer-status ${status}`}>{STATUS_LABELS[status]}</span>{o && <small class="spawn-range">{formatClock(o.diedAt + ELIGIBLE_AFTER, clock24)} – {formatClock(o.diedAt + SPAWN_AFTER, clock24)}</small>}</td>
    <td class="gathered-time" style={{ color: FRESHNESS_COLORS[freshnessBand(o?.gatheredAt, now, status)] }} title={o ? `${formatTimestamp(o.gatheredAt, clock24)} · ${Math.max(0, Math.floor((now - o.gatheredAt) / 60000))} min ago` : status === "outdated" ? "Outdated observation discarded" : undefined}>{o ? formatClock(o.gatheredAt, clock24, true) : status === "outdated" ? "—" : ""}</td><td>{o?.killedBy ?? ""}</td>
    <td class="row-actions"><button aria-label={`Edit ${boss.name} ${slot.region.toUpperCase()} channel ${slot.channel}`} onClick={() => onEdit({ ...slot, observation: o })}>Edit</button><button aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(!expanded)}>Details</button><button class="delete-timer" disabled={removing} title="Remove this local timer" aria-label={`Remove ${boss.name} ${slot.region.toUpperCase()} channel ${slot.channel}`} onClick={() => void remove()}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button></td>
  </tr>{expanded && <tr id={id} class="detail-row"><td colSpan={9}>{o ? <dl><dt>Killed at</dt><dd>{formatTimestamp(o.diedAt, clock24)}</dd><dt>Gathered at</dt><dd>{formatTimestamp(o.gatheredAt, clock24)}</dd><dt>Source</dt><dd>{o.source === "manual" ? "Manual entry" : "Gravestone capture"}</dd><dt>Observer</dt><dd>{o.observedByCharacter ?? "Unknown"}</dd>{o.submission && <><dt>Submitted by</dt><dd>{o.submission.submittedByCharacter ?? "Anonymous"}</dd><dt>Server accepted at</dt><dd>{formatTimestamp(o.submission.serverAcceptedAt, clock24)}</dd></>}<dt>Guaranteed spawn</dt><dd>{formatTimestamp(o.diedAt + SPAWN_AFTER, clock24)}</dd></dl> : <p>{status === "outdated" ? "This observation expired. Its kill time, killer and observer were discarded." : "No current observation for this slot."}</p>}</td></tr>}</>;
}
