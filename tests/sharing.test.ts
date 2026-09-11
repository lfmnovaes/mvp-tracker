import { afterEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SharingConnection } from "../src/backend/sharing";
import { parseConnection, type Discovery } from "../src/shared/sharing";
import { parseRequest } from "../src/shared/protocol";
const roots: string[] = [], connections: SharingConnection[] = [];
const config = { url: "https://test-group-123.convex.cloud", groupKey: "local_test_group_key_0123456789012345" };
const discovery = (): Discovery => ({ app: "mvp-tracker", protocol: 1, schema: 1, catalog: 1, serverTime: Date.now(), dataset: { datasetId: "dataset", generation: 1, revision: 0, resetAt: 0 } });
function response(value: unknown) { return new Response(JSON.stringify({ status: "success", value }), { status: 200 }); }
function make(fetcher?: typeof fetch) {
  const root = mkdtempSync(join(tmpdir(), "mvp-sharing-test-")); roots.push(root);
  const c = new SharingConnection(root, undefined, fetcher); connections.push(c); return { c, root };
}
afterEach(() => {
  for (const c of connections.splice(0)) c.close();
  for (const root of roots.splice(0)) { if (!root.startsWith(join(tmpdir(), "mvp-sharing-test-"))) throw new Error("Unsafe cleanup."); rmSync(root, { recursive: true, force: true }); }
});
test("connection origins and keys validate before transmission; IPC shares the same checks", () => {
  expect(parseConnection({ ...config, url: config.url + "/" })).toEqual(config);
  expect(parseConnection({ url: "", groupKey: "" })).toEqual({ url: "", groupKey: "" });
  expect(parseConnection({ url: config.url + "/", groupKey: "" })).toEqual({ url: config.url, groupKey: "" });
  for (const url of ["http://test.convex.cloud", "https://test.convex.site", "https://dashboard.convex.dev", "https://test.convex.cloud.evil.com", "https://user@test.convex.cloud", "https://test.convex.cloud:443", config.url + "/api", config.url + "?key=x", "https://127.0.0.1"]) expect(() => parseConnection({ ...config, url })).toThrow();
  expect(() => parseRequest({ id: "save", method: "sharingSave", input: { ...config, groupKey: "short" } })).toThrow();
});
test("secrets persist separately, snapshots omit the key, corrupt originals survive and removal keeps timer data", () => {
  const { c, root } = make(); expect(c.snapshot().configured).toBe(false); c.configure(config);
  expect(JSON.stringify(c.snapshot())).not.toContain(config.groupKey);
  expect(new SharingConnection(root).credentials()).toEqual(config);
  writeFileSync(join(root, "data", "timers.json"), "timer sentinel");
  c.configure({ url: "", groupKey: "" }); expect(readFileSync(join(root, "data", "timers.json"), "utf8")).toBe("timer sentinel");
  expect(readFileSync(c.file, "utf8")).not.toContain(config.groupKey);
  writeFileSync(c.file, '{"schemaVersion":99}'); expect(new SharingConnection(root).snapshot().state).toBe("error"); expect(readFileSync(c.file, "utf8")).toBe('{"schemaVersion":99}');
});
test("Test uses only the saved origin and a read-only query with redirects disabled", async () => {
  const requests: { url: string; init?: RequestInit }[] = [];
  const { c } = make((async (input: RequestInfo | URL, init?: RequestInit) => { requests.push({ url: String(input), init }); return response(discovery()); }) as unknown as typeof fetch);
  c.configure(config); expect((await c.test()).state).toBe("ready"); expect(requests).toHaveLength(1);
  expect(requests[0]?.url).toBe(config.url + "/api/query"); expect(requests[0]?.init?.redirect).toBe("error");
  const body = JSON.parse(String(requests[0]?.init?.body)); expect(body.path).toBe("timers:testConnection");
  expect(body.args).toEqual([{ key: config.groupKey, protocol: 1 }]);
});
test("changing the connection cancels an in-flight test and rejects its late response", async () => {
  let finish!: (r: Response) => void, signal: AbortSignal | undefined;
  const { c } = make((async (_input: RequestInfo | URL, init?: RequestInit) => { signal = init?.signal ?? undefined; return new Promise<Response>(r => { finish = r; }); }) as unknown as typeof fetch);
  c.configure(config); const pending = c.test();
  c.configure({ ...config, url: "https://other-group-456.convex.cloud" }); expect(signal?.aborted).toBe(true);
  finish(response(discovery())); await pending;
  expect(c.snapshot().state).toBe("untested"); expect(c.snapshot().url).toContain("other-group"); expect(c.snapshot().dataset).toBeUndefined();
});
test("missing initialization, version, quota, key, clock and network failures stay distinct and sanitized", async () => {
  const fixtures: [() => Response, string][] = [
    [() => response({ ...discovery(), dataset: null }), "initialize"],
    [() => response({ ...discovery(), schema: 99 }), "matching"],
    [() => response({ ...discovery(), serverTime: Date.now() + 60000 }), "clock"],
    [() => new Response("secret response", { status: 429 }), "rate-limiting"],
    [() => new Response("secret response", { status: 503 }), "quota"],
    [() => new Response(JSON.stringify({ status: "error", errorMessage: "secret", errorData: { code: "UNAUTHORIZED" } }), { status: 560 }), "group key was rejected"],
    [() => new Response(JSON.stringify({ status: "error", errorMessage: "Could not find public function secret" }), { status: 560 }), "functions are missing"],
  ];
  for (const [mock, message] of fixtures) { const { c } = make((async () => mock()) as unknown as typeof fetch); c.configure(config); const status = await c.test(); expect(status.state).toBe("error"); expect(status.message).toContain(message); expect(status.message).not.toContain("secret"); }
});
