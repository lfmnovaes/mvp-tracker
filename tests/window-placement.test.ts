import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

test.skipIf(process.platform !== "win32")("native window placement survives round trips, monitor moves/removal and smaller work areas", async () => {
  const root = mkdtempSync(join(tmpdir(), "mvp-placement-test-"));
  try {
    const exe = join(root, "placement-tests.exe");
    const compile = Bun.spawn([join(process.env.WINDIR ?? "C:/Windows", "Microsoft.NET/Framework64/v4.0.30319/csc.exe"), "/nologo", "/platform:x64", `/out:${exe}`, "/reference:System.Drawing.dll", "/reference:System.Web.Extensions.dll", resolve("native/WindowPlacement.cs"), resolve("tests/window-placement.cs")], { stdout: "pipe", stderr: "pipe", windowsHide: true });
    const output = await new Response(compile.stdout).text();
    expect(await compile.exited, output).toBe(0);
    const run = Bun.spawn([exe], { stdout: "pipe", stderr: "pipe", windowsHide: true });
    expect(await run.exited, await new Response(run.stderr).text()).toBe(0);
  } finally {
    if (!root.startsWith(join(tmpdir(), "mvp-placement-test-"))) throw new Error("Unsafe cleanup.");
    rmSync(root, { recursive: true, force: true });
  }
});
