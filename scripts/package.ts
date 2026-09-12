import { copyFile, cp, mkdir, rm, access, writeFile, readdir, rename } from "node:fs/promises";
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
await copyFile(join(root, "LICENSE.txt"), join(target, "LICENSE.txt"));
const sourceName = `MVP-Tracker-${VERSION}-source`;
const sourceLink = `https://github.com/lfmnovaes/mvp-tracker/releases/tag/app-v${VERSION}`;
await writeFile(join(target, "NOTICE.txt"), await Bun.file(join(root, "THIRD_PARTY_NOTICES.md")).text() + `\nCorresponding source: download ${sourceName}.zip from ${sourceLink}\n`);
await writeFile(join(target, "HELP.txt"), `MVP Tracker ${VERSION}\nExtract the entire ZIP to a writable folder and run MVP Tracker.exe.\nWindows 11 x64. Install Npcap and Microsoft Edge WebView2 if missing.\nClose hides to tray; use the tray menu to exit. Data and logs stay beside the executable.\nKeep extensions and licenses: they are required runtime files and notices.\nHelp and corresponding source: ${sourceLink}\nDownload ${sourceName}.zip for source, build instructions, and documentation.\n`);
await cp(join(root, "resources/licenses"), join(target, "licenses"), { recursive: true });
for (const name of await readdir(join(target, "licenses"))) if (name.endsWith(".md")) await rename(join(target, "licenses", name), join(target, "licenses", name.replace(/\.md$/, ".txt")));
const source = join(release, sourceName);
if (!source.startsWith(release + sep)) throw new Error("Unsafe source package path.");
for (const name of ["data", "logs"]) if (await access(join(source, name)).then(() => true, () => false)) throw new Error("Source staging contains user state.");
await rm(source, { recursive: true, force: true }); await mkdir(source, { recursive: true });
// Matching corresponding source is a separate release download.
for (const file of ["src", "native", "scripts", "tests", "docs", "licenses", "convex", ".github", "vitest.config.ts", ".env.local.sample", ".gitignore", ".gitattributes", "package.json", "bun.lock", "tsconfig.json", "neutralino.config.json", "README.md", "LICENSE.txt", "THIRD_PARTY_NOTICES.md", "dependency-provenance.md", "CHANGELOG.md"]) await cp(join(root, file), join(source, file), { recursive: true });
const metadata = await Bun.file(join(root, "package.json")).json();
const config = await Bun.file(join(root, "neutralino.config.json")).json();
const git = (args: string[]) => { const p = Bun.spawnSync(["git", "-c", `safe.directory=${root}`, ...args], { cwd: root, stdout: "pipe", stderr: "pipe", windowsHide: true }); return p.exitCode === 0 ? p.stdout.toString().trim() : null; };
const commit = git(["rev-parse", "HEAD"]), status = git(["status", "--porcelain", "--untracked-files=normal"]);
const manifest = { schemaVersion: 2, version: VERSION, target: "windows-x64", unsigned: true, sourceCommit: commit, sourceDirty: status === null ? null : status.length > 0,
  build: { bun: Bun.version, node: process.versions.node, os: osRelease(), image: process.env.ImageOS ?? "local", imageVersion: process.env.ImageVersion ?? null, neutralino: config.cli.binaryVersion, dependencies: metadata.dependencies, devDependencies: metadata.devDependencies },
  files: await inventory(target), sourceArchive: `${sourceName}.zip`, sourceFiles: await inventory(source, "", true) };
const manifestText = JSON.stringify(manifest, null, 2) + "\n";
await writeFile(join(target, "release-manifest.json"), manifestText);
const manifestFile = `${target}.manifest.json`; await writeFile(manifestFile, manifestText);
const zip = `${target}.zip`;
for (const folder of [target, source]) {
  const child = Bun.spawn(["powershell.exe", "-NoProfile", "-File", join(root, "scripts/zip.ps1"), "-Source", folder, "-Destination", `${folder}.zip`], { stdout: "inherit", stderr: "inherit", windowsHide: true });
  if (await child.exited) throw new Error("ZIP packaging failed.");
}
const checksums: string[] = [];
for (const file of [zip, `${source}.zip`, manifestFile]) checksums.push(`${createHash("sha256").update(new Uint8Array(await Bun.file(file).arrayBuffer())).digest("hex")}  ${file.slice(release.length + 1)}`);
await writeFile(`${target}.sha256`, checksums.join("\n") + "\n");
await copyFile(join(root, "docs", "release-notes.md"), join(release, "RELEASE-NOTES.md"));
console.log(`Portable package: ${zip}`);
