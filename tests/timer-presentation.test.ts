import { expect, test } from "bun:test";
import { FRESHNESS_COLORS, freshnessBand, rowRevision } from "../src/ui/timer-presentation";
import { EXPIRE_AFTER } from "../src/domain/time";
import type { TimerSlot } from "../src/domain/timers";

test("gathered freshness uses observation age, clamps clock skew and overrides expired evidence", () => {
  const gathered = 1_000_000;
  expect(FRESHNESS_COLORS).toHaveLength(11);
  expect(freshnessBand(gathered, gathered - 30000, "waiting")).toBe(0);
  for (let band = 0; band < 10; band++) expect(freshnessBand(gathered, gathered + band * EXPIRE_AFTER / 10, "spawned")).toBe(band);
  expect(freshnessBand(gathered, gathered + EXPIRE_AFTER * 2, "spawned")).toBe(9);
  expect(freshnessBand(gathered, gathered, "outdated")).toBe(10);
  expect(freshnessBand(undefined, gathered, "empty")).toBe(10);
});

test("row updates distinguish gathered-only refresh and attribution from identical polling snapshots", () => {
  const slot: TimerSlot = { mobId: "NightmarePaladinBoss", region: "sa", channel: 1, outdated: false,
    observation: { mobId: "NightmarePaladinBoss", region: "sa", channel: 1, observationId: "one", diedAt: 1000, gatheredAt: 2000, source: "manual", timePrecision: "second" } };
  const initial = rowRevision(slot, "waiting");
  expect(rowRevision(structuredClone(slot), "waiting")).toBe(initial);
  expect(rowRevision({ ...slot, observation: { ...slot.observation!, gatheredAt: 2001 } }, "waiting")).not.toBe(initial);
  expect(rowRevision({ ...slot, observation: { ...slot.observation!, submission: { submittedByCharacter: null, serverAcceptedAt: 2001 } } }, "waiting")).not.toBe(initial);
  expect(rowRevision(slot, "window")).not.toBe(initial);
});
