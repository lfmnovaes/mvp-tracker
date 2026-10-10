import { ChannelFilter } from "../src/ui/channel-filter";
import { LocationFilter } from "../src/ui/location-filter";
import { selectedLocations, bossPreset } from "../src/domain/catalog";
import { MAP_LEVELS } from "../src/domain/map-levels";
import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { TimerRowView } from "../src/ui/timer-row";
import { RecordingControls, type MonitorAction } from "../src/ui/recording-controls";
import { bossById } from "../src/domain/catalog";
import type { TimerRow } from "../src/domain/query";
const browser = new Window(), saved = new Map<string, PropertyDescriptor | undefined>();
let host: HTMLElement, animations: { options: any; cancelled: boolean }[] = [];
beforeAll(() => {
  for (const name of ["window", "document", "HTMLElement", "HTMLTableRowElement", "Element", "Node"]) {
    saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value: (browser as any)[name] ?? browser });
  }
  browser.matchMedia = (() => ({ matches: false })) as any;
  browser.HTMLElement.prototype.animate = ((_frames: unknown, options: unknown) => {
    const item = { options, cancelled: false }; animations.push(item); return { cancel: () => { item.cancelled = true; } };
  }) as any;
});
afterEach(async () => { if (host) { await act(() => render(null, host)); host.remove(); } animations = []; });
afterAll(async () => { await browser.happyDOM.close(); for (const [name, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete (globalThis as any)[name]; } });
const now = 1791336000000;
function row(): TimerRow {
  return { boss: bossById("NightmarePaladinBoss")!, status: "waiting", slot: { mobId: "NightmarePaladinBoss", region: "sa", channel: 1, outdated: false,
    observation: { mobId: "NightmarePaladinBoss", region: "sa", channel: 1, observationId: "test", diedAt: now - 600000, gatheredAt: now, source: "manual", timePrecision: "second", killedBy: "Test Killer" } } };
}
test("rendered rows animate insertion and gathered changes for four seconds, ignoring age/status/submission rerenders", async () => {
  host = document.createElement("tbody"); document.body.append(host);
  let value = row(), clock = now;
  const draw = () => render(<TimerRowView row={value} now={clock} clock24 colorInterval={3} onEdit={() => {}} onRemove={async () => {}}/>, host);
  await act(draw); expect(animations).toHaveLength(1); expect(animations[0]!.options.duration).toBe(4000);
  clock += 3 * 60000; value = { ...value, status: "window" };
  await act(draw); expect(animations).toHaveLength(1);
  value = { ...value, slot: { ...value.slot, observation: { ...value.slot.observation!, submission: { submittedByCharacter: null, serverAcceptedAt: clock } } } };
  await act(draw); expect(animations).toHaveLength(1);
  await act(() => (host.querySelector('button[aria-expanded]') as HTMLButtonElement).click());
  expect(host.textContent).toContain("Test Killer"); expect(host.textContent).toContain("Killed at"); expect(animations).toHaveLength(1);
  value = { ...value, slot: { ...value.slot, observation: { ...value.slot.observation!, gatheredAt: clock } } };
  await act(draw); expect(animations).toHaveLength(2); expect(animations[0]!.cancelled).toBe(true);
  await act(() => render(null, host)); expect(animations[1]!.cancelled).toBe(true);
});
test("restored rows and filter remounts remain quiet until gathered changes", async () => {
  host = document.createElement("tbody"); document.body.append(host); const value = row();
  const draw = () => render(<TimerRowView row={value} animateOnMount={false} now={now} clock24 colorInterval={3} onEdit={() => {}} onRemove={async () => {}}/>, host);
  await act(draw); await act(() => render(null, host)); await act(draw); expect(animations).toHaveLength(0);
  value.slot.observation!.gatheredAt++; await act(draw); expect(animations).toHaveLength(1);
});
test("recording controls coalesce optimization, keep Stop usable, and require confirmation to clear", async () => {
  host = document.createElement("div"); document.body.append(host);
  const actions: MonitorAction[] = [], messages: string[] = []; let complete!: () => void;
  const work = new Promise<void>(resolve => { complete = resolve; });
  const onAction = async (action: MonitorAction) => { actions.push(action); if (action === "optimize") await work; };
  await act(() => render(<RecordingControls connected now={now} status={{ active: true, until: now + 10000, frames: 1, events: 1, bytes: 100, rejected: 0 }} onAction={onAction} onMessage={value => messages.push(value)}/>, host));
  const button = (label: string) => [...host.querySelectorAll("button")].find(element => element.textContent === label) as HTMLButtonElement;
  await act(() => { button("Optimize all recordings").click(); });
  expect(button("Optimizing…").disabled).toBe(true); expect(button("Stop recording").disabled).toBe(false);
  await act(() => button("Optimizing…").click()); expect(actions).toEqual(["optimize"]);
  await act(() => button("Stop recording").click()); expect(actions).toContain("stop");
  await act(async () => { complete(); await work; });
  window.confirm = () => false; await act(() => button("Clear recordings").click()); expect(actions).not.toContain("clear");
  window.confirm = () => true; await act(() => button("Clear recordings").click()); expect(actions).toContain("clear");
  expect(messages).toHaveLength(0); expect(host.textContent).not.toContain("Mark crypt encounter");
});

test("background recording status blocks duplicate jobs and reports completion once", async () => {
  host = document.createElement("div"); document.body.append(host);
  const messages: string[] = [], actions: MonitorAction[] = [];
  let status: import("../src/shared/monitor").MonitorStatus = { active: false, until: 0, frames: 1, events: 1, bytes: 100, rejected: 0, message: "Previous completion" };
  const draw = () => render(<RecordingControls connected now={now} status={status} onAction={async action => { actions.push(action); }} onMessage={value => messages.push(value)}/>, host);
  await act(draw); expect(messages).toHaveLength(0);
  status = { ...status, maintenance: "optimize", message: undefined };
  await act(draw);
  const buttons = [...host.querySelectorAll("button")];
  expect(buttons[0]!.disabled).toBe(true); expect(buttons[1]!.disabled).toBe(true); expect(buttons[2]!.disabled).toBe(true);
  await act(() => buttons[1]!.click()); expect(actions).toHaveLength(0);
  status = { ...status, maintenance: undefined, message: "Optimized 2" };
  await act(draw); expect(messages).toEqual(["Optimized 2"]);
  await act(draw); expect(messages).toHaveLength(1);
  expect((host.querySelectorAll("button")[1] as HTMLButtonElement).disabled).toBe(false);
});

test("location labels show every map level while selected values remain raw map names", async () => {
  host = document.createElement("div"); document.body.append(host);
  const locations = selectedLocations({ bossIds: bossPreset("all"), regions: ["sa"] }), changes: string[] = [];
  await act(() => render(<LocationFilter locations={locations} value="Dark Fortress" onChange={value => changes.push(value)}/>, host));
  const select = host.querySelector("select")!;
  expect(select.value).toBe("Dark Fortress");
  expect(select.options[1]!.textContent).toBe("Dark Fortress (150)");
  expect(select.options[2]!.textContent).toBe("Dark Manor (145)");
  for (const [index, map] of locations.entries()) {
    expect(select.options[index + 1]!.value).toBe(map);
    expect(select.options[index + 1]!.textContent).toBe(map + " (" + MAP_LEVELS[map] + ")");
  }
  await act(() => { select.value = "Dark Manor"; select.dispatchEvent(new browser.Event("change", { bubbles: true }) as unknown as Event); });
  expect(changes).toEqual(["Dark Manor"]);
  await act(() => { select.value = ""; select.dispatchEvent(new browser.Event("change", { bubbles: true }) as unknown as Event); });
  expect(changes.at(-1)).toBe("");
});

test("rendered channel filter offers observed PvP IDs with no intermediate channels", async () => {
  host = document.createElement("div"); document.body.append(host); const changes: (number | "")[] = [];
  await act(() => render(<ChannelFilter channels={[1, 2, 3, 5, 10]} value={5} onChange={value => changes.push(value)}/>, host));
  const select = host.querySelector("select")!;
  expect([...select.options].map(o => o.value)).toEqual(["", "1", "2", "3", "5", "10"]);
  expect(select.value).toBe("5"); expect(select.options[4]!.textContent).toBe("Ch 5 · PvP");
  await act(() => { select.value = "10"; select.dispatchEvent(new browser.Event("change", { bubbles: true }) as unknown as Event); }); expect(changes).toEqual([10]);
  await act(() => render(<ChannelFilter channels={[1, 2, 3]} value="" onChange={value => changes.push(value)}/>, host));
  expect(select.value).toBe(""); expect(select.options).toHaveLength(4);
});
