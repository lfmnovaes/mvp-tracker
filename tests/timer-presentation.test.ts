import { expect, test } from "bun:test";
import { FRESHNESS_COLORS, freshnessBand, rowRevision, shouldAnimateGathered, ROW_ANIMATION_MS } from "../src/ui/timer-presentation";
import { MINUTE } from "../src/domain/time";
import { COLOR_INTERVALS } from "../src/shared/colors";
import { defaults, parseSettings } from "../src/shared/protocol";
import type { TimerSlot } from "../src/domain/timers";

test("gathered freshness uses observation age, clamps clock skew and overrides expired evidence", () => {
  const gathered = 1_000_000;
  expect(FRESHNESS_COLORS).toHaveLength(11);
  expect(freshnessBand(gathered, gathered - 30000, "waiting")).toBe(0);
  expect(freshnessBand(gathered, gathered + 3 * MINUTE - 1, "waiting")).toBe(0);
  expect(freshnessBand(gathered, gathered + 3 * MINUTE, "waiting")).toBe(1);
  for (const interval of COLOR_INTERVALS) for (let band = 0; band < 10; band++) expect(freshnessBand(gathered, gathered + band * interval * MINUTE, "spawned", interval)).toBe(band);
  expect(freshnessBand(gathered, gathered + 1000 * MINUTE, "spawned")).toBe(9);
  expect(freshnessBand(gathered, gathered, "outdated")).toBe(10);
  expect(freshnessBand(undefined, gathered, "empty")).toBe(10);
});

test("only gathered-time changes trigger the three-second highlight", () => {
  const slot: TimerSlot = { mobId: "NightmarePaladinBoss", region: "sa", channel: 1, outdated: false,
    observation: { mobId: "NightmarePaladinBoss", region: "sa", channel: 1, observationId: "one", diedAt: 1000, gatheredAt: 2000, source: "manual", timePrecision: "second" } };
  const initial = rowRevision(slot, "waiting");
  expect(rowRevision(structuredClone(slot), "waiting")).toBe(initial);
  expect(rowRevision({ ...slot, observation: { ...slot.observation!, gatheredAt: 2001 } }, "waiting")).not.toBe(initial);
  expect(rowRevision({ ...slot, observation: { ...slot.observation!, submission: { submittedByCharacter: null, serverAcceptedAt: 2001 } } }, "waiting")).toBe(initial);
  expect(rowRevision(slot, "window")).toBe(initial);
  expect(shouldAnimateGathered(initial, initial)).toBe(false);
  expect(shouldAnimateGathered(initial, 2001)).toBe(true);
  expect(shouldAnimateGathered(initial, undefined)).toBe(false);
  expect(shouldAnimateGathered(undefined, 2000)).toBe(true);
  expect(ROW_ANIMATION_MS).toBe(3000);
});

test("color settings migrate to three minutes and retain valid saved choices", () => {
  expect(defaults().colorInterval).toBe(3);
  expect(parseSettings({ ...defaults(), schemaVersion: 7, colorInterval: undefined }).colorInterval).toBe(3);
  for (const interval of COLOR_INTERVALS) expect(parseSettings({ ...defaults(), colorInterval: interval }).colorInterval).toBe(interval);
  for (const interval of [0, -1, 4, NaN]) expect(() => parseSettings({ ...defaults(), colorInterval: interval })).toThrow();
});
