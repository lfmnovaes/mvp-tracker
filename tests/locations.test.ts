import { expect, test } from "bun:test";
import { BOSSES, bossPreset, selectedLocations } from "../src/domain/catalog";
import { MAP_LEVELS } from "../src/domain/map-levels";
test("location filter orders actual map levels descending, with stable alphabetical ties and selected-only options", () => {
  const locations = selectedLocations({ bossIds: bossPreset("all"), regions: ["sa"] });
  expect(locations.slice(0, 2)).toEqual(["Dark Fortress", "Dark Manor"]);
  for (const boss of BOSSES) expect(MAP_LEVELS[boss.map]).toBeGreaterThan(0);
  for (let i = 1; i < locations.length; i++) {
    const previous = locations[i - 1]!, current = locations[i]!;
    expect(MAP_LEVELS[previous]!).toBeGreaterThanOrEqual(MAP_LEVELS[current]!);
    if (MAP_LEVELS[previous] === MAP_LEVELS[current]) expect(previous.localeCompare(current, "en")).toBeLessThan(0);
  }
  expect(selectedLocations({ bossIds: bossPreset("endgame"), regions: ["sa"] })).toEqual(["Dark Fortress"]);
  expect(selectedLocations({ bossIds: [], regions: ["sa"] })).toEqual([]);
});
