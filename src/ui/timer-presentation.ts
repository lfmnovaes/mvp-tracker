import { MINUTE } from "../domain/time";
import { DEFAULT_COLOR_INTERVAL } from "../shared/colors";
import { type TimerSlot, type TimerStatus } from "../domain/timers";
import type { WorldPosition } from "../domain/timers";
export function coordinateLabel(position?: WorldPosition): string { return position ? `${position.x.toFixed(1)}, ${position.z.toFixed(1)}` : "Not located"; }
// Ten configurable age bands, followed by a distinct expired/no-evidence color.
export const FRESHNESS_COLORS = ["#79dda2", "#a0da86", "#c1d66f", "#ded068", "#efc065", "#f0aa67", "#ed926b", "#e77c70", "#df6973", "#d65b69", "#96747b"] as const;
export function freshnessBand(gatheredAt: number | undefined, now: number, status: TimerStatus, interval = DEFAULT_COLOR_INTERVAL): number {
  if (status === "outdated" || gatheredAt === undefined) return 10;
  return Math.min(9, Math.floor(Math.max(0, now - gatheredAt) / (interval * MINUTE)));
}
export function rowRevision(slot: TimerSlot, _status?: TimerStatus): number | undefined { return slot.observation?.gatheredAt; }
export function shouldAnimateGathered(previous: number | undefined, current: number | undefined): boolean { return current !== undefined && previous !== current; }
export const ROW_ANIMATION_MS = 3000;
