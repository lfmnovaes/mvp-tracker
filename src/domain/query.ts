import { bossById, isSelected, normalizeRegion, type Boss, type Channel, type Region, type Selection } from "./catalog";
import { ELIGIBLE_AFTER, SPAWN_AFTER } from "./time";
import { timerStatus, type TimerSlot, type TimerStatus } from "./timers";
export const SORT_FIELDS = ["boss", "level", "location", "region", "channel", "status", "gathered", "killer"] as const;
export type SortField = typeof SORT_FIELDS[number];
export interface Sort { field: SortField; direction: "asc" | "desc" }
export const defaultSort = (): Sort => ({ field: "status", direction: "asc" });
export function parseSort(raw: unknown): Sort {
  const sort = raw as Sort;
  if (!sort || !SORT_FIELDS.includes(sort.field) || !["asc", "desc"].includes(sort.direction)) throw new Error("Invalid sort preference.");
  return { field: sort.field, direction: sort.direction };
}
export interface TimerRow { slot: TimerSlot; boss: Boss; status: TimerStatus }
export const STATUS_LABELS: Record<TimerStatus, string> = { waiting: "Waiting", window: "Spawn window", spawned: "Spawned", outdated: "Outdated", empty: "No data" };
function normalized(text: string): string { return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim(); }
export function matchesSearch(row: TimerRow, query: string): boolean {
  const { slot, boss } = row;
  const fields = { boss: normalized(boss.name), map: normalized(boss.map), region: slot.region, killer: normalized(slot.observation?.killedBy ?? "") };
  const all = Object.values(fields).join(" ");
  return normalized(query).split(/\s+/).filter(Boolean).every(token => {
    const channel = /^(?:ch|channel)(?::)?(\d+)$/.exec(token);
    if (channel) return Number(channel[1]) === slot.channel;
    if (token.startsWith("ch:") || token.startsWith("channel:")) return false;
    if (token.startsWith("region:")) return normalizeRegion(token.slice(7)) === slot.region;
    const region = normalizeRegion(token);
    if (region) return region === slot.region;
    for (const field of ["boss", "map", "killer"] as const) if (token.startsWith(`${field}:`)) return token.length > field.length + 1 && fields[field].includes(token.slice(field.length + 1));
    return all.includes(token);
  });
}
const statusRank: Record<TimerStatus, number> = { spawned: 0, window: 1, waiting: 2, outdated: 3, empty: 4 };
function boundary(row: TimerRow): number { return row.slot.observation ? row.slot.observation.diedAt + (row.status === "waiting" ? ELIGIBLE_AFTER : SPAWN_AFTER) : 0; }
function stable(a: TimerRow, b: TimerRow): number {
  return a.boss.name.localeCompare(b.boss.name, "en") || a.slot.region.localeCompare(b.slot.region, "en") || a.slot.channel - b.slot.channel;
}
export function compareRows(a: TimerRow, b: TimerRow, sort: Sort): number {
  let difference = 0;
  switch (sort.field) {
    case "boss": difference = a.boss.name.localeCompare(b.boss.name, "en"); break;
    case "level": difference = a.boss.level - b.boss.level; break;
    case "location": difference = a.boss.map.localeCompare(b.boss.map, "en"); break;
    case "region": difference = a.slot.region.localeCompare(b.slot.region, "en"); break;
    case "channel": difference = a.slot.channel - b.slot.channel; break;
    case "killer": difference = (a.slot.observation?.killedBy ?? "").localeCompare(b.slot.observation?.killedBy ?? "", "en"); break;
    case "gathered": {
      const at = a.slot.observation?.gatheredAt, bt = b.slot.observation?.gatheredAt;
      // Empty cells stay last, in either direction.
      if (at === undefined || bt === undefined) return at === bt ? stable(a, b) : at === undefined ? 1 : -1;
      difference = at - bt; break;
    }
    case "status": difference = statusRank[a.status] - statusRank[b.status] || boundary(a) - boundary(b); break;
  }
  return difference * (sort.direction === "asc" ? 1 : -1) || stable(a, b);
}
export interface Query { search?: string; region?: Region; channel?: Channel; sort?: Sort }
export function queryTimers(slots: readonly TimerSlot[], selection: Selection, now: number, query: Query = {}): TimerRow[] {
  return slots.filter(slot => isSelected(slot, selection) && (!query.region || slot.region === query.region) && (!query.channel || slot.channel === query.channel))
    .map(slot => ({ slot, boss: bossById(slot.mobId)!, status: timerStatus(slot, now) }))
    .filter(row => matchesSearch(row, query.search ?? ""))
    .sort((a, b) => compareRows(a, b, query.sort ?? defaultSort()));
}
