import { bossById, CHANNELS, isSelected, type Region, type Selection } from "./catalog";
import type { TimerSlot } from "./timers";
/** Extra channels appear only after a visible PvP timer has been collected or shared. */
export function availableChannels(slots: readonly TimerSlot[], selection: Selection, region?: Region, location?: string): number[] {
  return [...new Set<number>([...CHANNELS, ...slots.filter(s => s.pvp && isSelected(s, selection) && (!region || s.region === region) && (!location || bossById(s.mobId)?.map === location)).map(s => s.channel)])].sort((a, b) => a - b);
}
