import { test, expect } from "bun:test";
import { NeutralinoClient } from "../src/backend/neutralino-client";

test("extension transport handles native results, error envelopes and socket loss", async () => {
  const server = Bun.serve({
    port: 0,
    fetch(request, server) { if (server.upgrade(request)) return; return new Response("Invalid", { status: 400 }); },
    websocket: {
      message(socket, raw) {
        const request = JSON.parse(String(raw));
        if (request.method === "ok") socket.send(JSON.stringify({ id: request.id, data: { success: true, returnValue: { alive: true } } }));
        if (request.method === "fail") socket.send(JSON.stringify({ id: request.id, data: { error: { code: "DENIED" } } }));
        if (request.method === "disconnect") socket.close();
      },
    },
  });
  const client = await NeutralinoClient.connect({ nlPort: server.port!, nlToken: "test-token", nlConnectToken: "test-connect", nlExtensionId: "test" });
  try {
    expect(await client.call<{ alive: boolean }>("ok")).toEqual({ alive: true });
    await expect(client.call("fail")).rejects.toThrow("native call failed");
    await expect(client.call("disconnect")).rejects.toThrow("socket closed");
    await expect(client.call("ok")).rejects.toThrow("not open");
  } finally { client.close(); await server.stop(true); }
});
