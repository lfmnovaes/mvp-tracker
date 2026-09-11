import * as Neutralino from "@neutralinojs/lib";
import { EXTENSION, REQUEST, RESPONSE, UPDATE, type Method, type Operations, type Response, type Update } from "../shared/protocol";
const pending = new Map<string, { resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
const listeners = new Set<(value: Update) => void>();
let initialized: Promise<void> | undefined;
export function connect() {
  return initialized ??= (async () => {
    Neutralino.init();
    await Neutralino.events.on(RESPONSE, event => {
      const response = event.detail as Response;
      const call = pending.get(response.id); if (!call) return;
      pending.delete(response.id); clearTimeout(call.timer);
      if (response.error) call.reject(new Error(response.error)); else call.resolve(response.result);
    });
    await Neutralino.events.on(UPDATE, event => { for (const listener of listeners) listener(event.detail as Update); });
    await Neutralino.window.setDraggableRegion("drag-region");
  })();
}
export function subscribe(listener: (value: Update) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export async function call<K extends Method>(method: K, input: Operations[K]["input"]): Promise<Operations[K]["output"]> {
  await connect();
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    // Reset drains any active sync and can recover a changed generation before replying.
    const timeout = method === "sharingReset" ? 60_000 : 12_000;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error("The backend is not responding. Restart MVP Tracker if this continues.")); }, timeout);
    pending.set(id, { resolve: resolve as (value: unknown) => void, reject, timer });
    void Neutralino.extensions.dispatch(EXTENSION, REQUEST, { id, method, input }).catch(() => {
      clearTimeout(timer); pending.delete(id); reject(new Error("The backend connection is unavailable."));
    });
  });
}
export const emergencyExit = () => Neutralino.app.exit();
