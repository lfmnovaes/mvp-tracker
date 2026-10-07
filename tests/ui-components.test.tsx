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
