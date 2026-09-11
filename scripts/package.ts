import { copyFile, cp, mkdir, rm, access, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { release as osRelease } from "node:os";
import { inventory } from "./release-files";
import { resolve, join, sep } from "node:path";
import { VERSION } from "../src/shared/protocol";
const root = resolve(import.meta.dir, "..");
const release = join(root, "release");
const target = join(release, `MVP-Tracker-${VERSION}-windows-x64`);
// Only replace this generated version's package; portable user data is never a source.
if (!target.startsWith(release + sep)) throw new Error("Unsafe package path.");
for (const name of ["data", "logs"]) {
  const exists = await access(join(target, name)).then(() => true, () => false);
  if (exists) throw new Error("This release folder contains user state. Move that running copy before rebuilding.");
}
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await copyFile(join(root, "dist/mvp-tracker/mvp-tracker-win_x64.exe"), join(target, "MVP Tracker.exe"));
await copyFile(join(root, "dist/mvp-tracker/resources.neu"), join(target, "resources.neu"));
for (const file of ["bin/bun.exe", "bin/mvp-shell.exe", "bin/icon.ico", "backend/index.js"]) {
  await mkdir(join(target, "extensions", file.split("/")[0]!), { recursive: true });
  await copyFile(join(root, "extensions", file), join(target, "extensions", file));
}
for (const file of ["README.md", "LICENSE.txt", "THIRD_PARTY_NOTICES.md", "dependency-provenance.md", "plan.md", ".env.local.sample", "CHANGELOG.md"]) await copyFile(join(root, file), join(target, file));
// Keep the portable README's relative help links usable outside the source checkout.
await cp(join(root, "docs"), join(target, "docs"), { recursive: true });
await cp(join(root, "resources/licenses"), join(target, "licenses"), { recursive: true });
const source = join(target, "source"); await mkdir(source, { recursive: true });
// Corresponding source is carried with the unsigned portable artifact.
for (const file of ["src", "native", "scripts", "tests", "docs", "licenses", "convex", ".github", "vitest.config.ts", ".env.local.sample", ".gitignore", ".gitattributes", "package.json", "bun.lock", "tsconfig.json", "neutralino.config.json", "README.md", "LICENSE.txt", "THIRD_PARTY_NOTICES.md", "dependency-provenance.md", "plan.md", "CHANGELOG.md"]) await cp(join(root, file), join(source, file), { recursive: true });
const metadata = await Bun.file(join(root, "package.json")).json();
const config = await Bun.file(join(root, "neutralino.config.json")).json();
const git = (args: string[]) => { const p = Bun.spawnSync(["git", "-c", `safe.directory=${root}`, ...args], { cwd: root, stdout: "pipe", stderr: "pipe", windowsHide: true }); return p.exitCode === 0 ? p.stdout.toString().trim() : null; };
const commit = git(["rev-parse", "HEAD"]), status = git(["status", "--porcelain", "--untracked-files=normal"]);
const manifest = { schemaVersion: 1, version: VERSION, target: "windows-x64", unsigned: true, sourceCommit: commit, sourceDirty: status === null ? null : status.length > 0,
  build: { bun: Bun.version, node: process.versions.node, os: osRelease(), image: process.env.ImageOS ?? "local", imageVersion: process.env.ImageVersion ?? null, neutralino: config.cli.binaryVersion, dependencies: metadata.dependencies, devDependencies: metadata.devDependencies },
  files: await inventory(target) };
const manifestText = JSON.stringify(manifest, null, 2) + "\n";
await writeFile(join(target, "release-manifest.json"), manifestText);
const manifestFile = `${target}.manifest.json`; await writeFile(manifestFile, manifestText);
const zip = `${target}.zip`;
const child = Bun.spawn(["powershell.exe", "-NoProfile", "-File", join(root, "scripts/zip.ps1"), "-Source", target, "-Destination", zip], { stdout: "inherit", stderr: "inherit", windowsHide: true });
if (await child.exited) throw new Error("ZIP packaging failed.");
const checksums: string[] = [];
for (const file of [zip, manifestFile]) checksums.push(`${createHash("sha256").update(new Uint8Array(await Bun.file(file).arrayBuffer())).digest("hex")}  ${file.slice(release.length + 1)}`);
await writeFile(`${target}.sha256`, checksums.join("\n") + "\n");
await copyFile(join(root, "docs", "release-notes.md"), join(release, "RELEASE-NOTES.md"));
console.log(`Portable package: ${zip}`);
