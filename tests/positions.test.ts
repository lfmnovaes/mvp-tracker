import { expect, test } from "bun:test";
import { defaultSelection } from "../src/domain/catalog";
import { parseObservation, parseTimerState, type Observation } from "../src/domain/timers";
import { exportTimers, decodeImport } from "../src/backend/exchange";
import { coordinateLabel } from "../src/ui/timer-presentation";
const now = 1_789_000_000_000;
const slot = { mobId: "NightmarePaladinBoss", region: "sa", channel: 1 } as const;
const kill: Observation = { ...slot, observationId: "grave", source: "gravestone", timePrecision: "millisecond", gatheredAt: now, diedAt: now - 600000,
  position: { x: 12, y: 3, z: -21 }, killedBy: "Killer", observedByCharacter: "Observer", submission: { submittedByCharacter: null, serverAcceptedAt: now } };

test("full formats preserve ground position and attribution, with safe coordinate validation", () => {
  const row = { ...slot, outdated: false, observation: kill };
  for (const format of ["json", "compressed"] as const) expect(decodeImport(exportTimers([row], defaultSelection(), now, format).text, now)).toEqual([kill]);
  const legacy = JSON.parse(exportTimers([row], defaultSelection(), now, "json").text); legacy.schemaVersion = 1;
  expect(decodeImport(JSON.stringify(legacy), now)).toEqual([kill]);
  expect(coordinateLabel()).toBe("Not located"); expect(coordinateLabel(kill.position)).toBe("12.0, -21.0");
  for (const position of [{ x: Infinity, y: 0, z: 0 }, { x: 1, z: 2 }, { x: 100001, y: 1, z: 2 }]) expect(() => parseObservation({ ...kill, position }, now)).toThrow();
});

test("retired sighting data is discarded on load without blocking valid kills; new sightings are rejected", () => {
  const retired = { ...slot, channel: 2, observationId: "retired", source: "alive", gatheredAt: now, timePrecision: "millisecond" };
  const rows = parseTimerState({ schemaVersion: 2, slots: [{ ...slot, observation: kill, outdated: false }, { ...retired, observation: retired, outdated: false }] }, now);
  expect(rows[0]?.observation).toEqual(kill); expect(rows[1]?.observation).toBeUndefined(); expect(rows[1]?.outdated).toBe(true);
  expect(() => parseObservation(retired, now)).toThrow();
});
