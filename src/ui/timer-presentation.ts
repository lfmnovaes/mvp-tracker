import { EXPIRE_AFTER } from "../domain/time";
import { evidenceContent, type TimerSlot, type TimerStatus } from "../domain/timers";
import type { WorldPosition } from "../domain/timers";
export function coordinateLabel(position?: WorldPosition): string { return position ? `${position.x.toFixed(1)}, ${position.z.toFixed(1)}` : "Not located"; }
export function sightingAge(gatheredAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - gatheredAt) / 1000));
  return `Seen ${seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m`} ago`;
}
// Ten 15-minute age bands, followed by a distinct expired/no-evidence color.
export const FRESHNESS_COLORS = ["#79dda2", "#a0da86", "#c1d66f", "#ded068", "#efc065", "#f0aa67", "#ed926b", "#e77c70", "#df6973", "#d65b69", "#96747b"] as const;
export function freshnessBand(gatheredAt: number | undefined, now: number, status: TimerStatus): number {
  if (status === "outdated" || gatheredAt === undefined) return 10;
  return Math.min(9, Math.floor(Math.max(0, now - gatheredAt) / (EXPIRE_AFTER / 10)));
}
export function rowRevision(slot: TimerSlot, status: TimerStatus): string {
  const o = slot.observation;
  return JSON.stringify([status, slot.outdated, o && evidenceContent(o), o?.submission?.submittedByCharacter, o?.submission?.serverAcceptedAt]);
}
