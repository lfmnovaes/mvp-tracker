import { cp, mkdir, copyFile, rm } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
if (process.platform !== "win32" || process.arch !== "x64") throw new Error("Build on Windows x64.");
const root = resolve(import.meta.dir, "..");
process.chdir(root);
const metadata = await Bun.file("package.json").json();
const config = await Bun.file("neutralino.config.json").json();
const { VERSION } = await import("../src/shared/protocol");
if (metadata.version !== VERSION || config.version !== VERSION) throw new Error("Version metadata differs.");
// Recreate generated resources so stale files cannot enter resources.neu.
for (const name of ["resources", "extensions"]) {
  const target = resolve(root, name);
  if (!target.startsWith(root + sep)) throw new Error("Unsafe generated path.");
  if (process.execPath.startsWith(target + sep)) throw new Error("Use an installed Bun to rebuild, not the bundled runtime.");
  await rm(target, { recursive: true, force: true });
}
async function run(args: string[]) {
  const child = Bun.spawn(args, { stdout: "inherit", stderr: "inherit", windowsHide: true });
  if (await child.exited) throw new Error(`Build command failed: ${args[0]}`);
}
await mkdir("resources", { recursive: true });
await mkdir("extensions/backend", { recursive: true });
await mkdir("extensions/bin", { recursive: true });
for (const [entry, outdir, target] of [["src/ui/index.tsx", "resources", "browser"], ["src/backend/index.ts", "extensions/backend", "bun"]] as const) {
  const result = await Bun.build({ entrypoints: [entry], outdir, target, format: "esm", naming: "index.[ext]", minify: false });
  if (!result.success) throw new AggregateError(result.logs, "Bundle failed.");
}
await copyFile("src/ui/index.html", "resources/index.html");
await copyFile("src/ui/style.css", "resources/style.css");
await copyFile(process.execPath, "extensions/bin/bun.exe");
await run(["powershell.exe", "-NoProfile", "-File", "scripts/icon.ps1"]);
const csc = join(process.env.WINDIR ?? "C:/Windows", "Microsoft.NET/Framework64/v4.0.30319/csc.exe");
await run([csc, "/nologo", "/optimize+", "/platform:x64", "/target:exe", `/out:${join(root, "extensions/bin/mvp-shell.exe")}`, `/win32icon:${join(root, "extensions/bin/icon.ico")}`, "/reference:System.Windows.Forms.dll", "/reference:System.Drawing.dll", "/reference:System.Web.Extensions.dll", join(root, "native/ShellHost.cs"), join(root, "native/WindowPlacement.cs")]);
// Include the bundled frontend dependency licenses, plus native runtime notices.
await mkdir("resources/licenses", { recursive: true });
for (const name of ["preact", "@neutralinojs/lib", "convex"]) {
  const folder = join("node_modules", name);
  const license = new Bun.Glob("{LICENSE,LICENSE.*,license,license.*}");
  for await (const file of license.scan(folder)) await copyFile(join(folder, file), join("resources/licenses", `${name.replaceAll("/", "-")}-${file}`));
}
await cp("licenses", "resources/licenses", { recursive: true });
console.log(`Built MVP Tracker ${VERSION} for Windows x64.`);
