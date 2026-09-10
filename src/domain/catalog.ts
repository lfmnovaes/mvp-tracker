// Minimal catalog extracted from spirit-vale-tools, commit 87db1d724d5738ec8b5f3cb258e357e757813264.
// packages/rewards/src/catalog/definitions/mobs.ts — kar-mi, AGPL-3.0-only.
// Only boss IDs/names/levels are retained. Robot Dragon is deliberately excluded.
export const CATALOG_VERSION = 1;
const rows = [
  ["NightmareBerserkerBoss", "Echo Berserker Master", 155],
  ["NightmareGunslingerBoss", "Echo Gunslinger Master", 155],
  ["NightmareNecromancerBoss", "Echo Necromancer Master", 155],
  ["NightmarePaladinBoss", "Echo Paladin Master", 155],
  ["NightmarePriestBoss", "Echo Priest Master", 155],
  ["NightmareShinobiBoss", "Echo Shinobi Master", 155],
  ["NightmareWizardBoss", "Echo Wizard Master", 155],
  ["NightmareWeaverBoss", "Echo Weaver Master", 150],
  ["Mega Ice Golem", "Ice Titan", 140],
  ["Turtle King", "Turtle Champion", 140],
  ["Alien Big Blink", "Cosmic Entity", 135],
  ["Spider Queen Robot", "Suphara", 135],
  ["Death Mage", "Abyss Archon", 130],
  ["Goblin Warchief", "Orc Warchief", 130],
  ["Wraith", "Wraith King", 125],
  ["Eyeball Monster", "Kraken", 110],
  ["Imp Devil", "Demon Lord", 105],
  ["Worm Creep", "Devourer", 95],
  ["Angel Mage", "Seraphim Arbiter", 90],
  ["Ice Mage", "Ice Mage", 80],
  ["Queen Worm", "Broodmother", 75],
  ["Zombie Goblin King", "Zombie Orc Lord", 65],
  ["Bat Lord", "Night Baron", 55],
  ["Goblin Giant Gold", "Orc King", 55],
  ["Snake Naga", "Naga", 50],
  ["Hermit King", "Hermit King", 45],
  ["Cactus Boss", "Cactus King", 40],
  ["Sunflora Pixie", "Lady Fey", 40],
  ["Scorpion King", "Scorpion King", 40],
  ["Cat Bolt", "Raiju", 35],
  ["Werewolf", "Lycanthrope", 30],
  ["Hare", "Vorpal Hare", 30],
  ["Sting", "Vespa", 15],
] as const;
export type BossId = typeof rows[number][0];
const codes: Partial<Record<BossId, string>> = {
  NightmareBerserkerBoss: "b", NightmareGunslingerBoss: "g", NightmareNecromancerBoss: "n",
  NightmarePaladinBoss: "pa", NightmarePriestBoss: "pr", NightmareShinobiBoss: "s", NightmareWizardBoss: "w",
};
export interface Boss { id: BossId; name: string; level: number; map: string; endgame: boolean; textCode?: string }
export const BOSSES: readonly Boss[] = Object.freeze(rows.map(([id, name, level]) => Object.freeze({
  id, name, level, map: codes[id] ? "Dark Fortress" : "", endgame: !!codes[id], ...(codes[id] ? { textCode: codes[id] } : {}),
})).sort((a, b) => b.level - a.level || a.name.localeCompare(b.name, "en")));
const byId = new Map(BOSSES.map(b => [b.id, b]));
export function bossById(id: unknown): Boss | undefined { return typeof id === "string" ? byId.get(id as BossId) : undefined; }
export function bossPreset(preset: "all" | "endgame" | "none"): BossId[] {
  return BOSSES.filter(b => preset === "all" || (preset === "endgame" && b.endgame)).map(b => b.id);
}
export const REGIONS = ["sa", "na", "oce", "jp", "eu", "sea"] as const;
export type Region = typeof REGIONS[number];
export const CHANNELS = [1, 2, 3] as const;
export type Channel = typeof CHANNELS[number];
const aliases: Record<string, Region> = { sa: "sa", nova: "sa", na: "na", sun: "na", oce: "oce", aurora: "oce", jp: "jp", eu: "eu", star: "eu", sea: "sea" };
export function normalizeRegion(value: unknown): Region | undefined {
  if (typeof value !== "string") return undefined;
  return Object.hasOwn(aliases, value.trim().toLowerCase()) ? aliases[value.trim().toLowerCase()] : undefined;
}
// Capture's instance prefix parsing is deliberately separate from strict shared-record validation.
export function regionFromInstance(value: unknown): Region | undefined {
  if (typeof value !== "string") return undefined;
  const prefix = /^[a-z]+(?=$|[-_\d])/i.exec(value.trim())?.[0];
  return normalizeRegion(prefix);
}
export interface Selection { bossIds: BossId[]; regions: Region[] }
export const defaultSelection = (): Selection => ({ bossIds: bossPreset("endgame"), regions: ["sa", "na"] });
export function parseSelection(value: unknown): Selection {
  if (!value || typeof value !== "object") throw new Error("Invalid tracking selection.");
  const s = value as Selection;
  if (!Array.isArray(s.bossIds) || s.bossIds.length > BOSSES.length || !s.bossIds.every(bossById)) throw new Error("Invalid boss selection.");
  if (!Array.isArray(s.regions) || s.regions.length > REGIONS.length || !s.regions.every(r => REGIONS.includes(r))) throw new Error("Invalid region selection.");
  return { bossIds: BOSSES.filter(b => s.bossIds.includes(b.id)).map(b => b.id), regions: REGIONS.filter(r => s.regions.includes(r)) };
}
export function isSelected(slot: { mobId: BossId; region: Region }, selection: Selection): boolean {
  return selection.bossIds.includes(slot.mobId) && selection.regions.includes(slot.region);
}
