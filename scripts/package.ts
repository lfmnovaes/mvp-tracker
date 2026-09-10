import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import { resolve, join, sep } from "node:path";
import { VERSION } from "../src/shared/protocol";
const root = resolve(import.meta.dir, "..");
const release = join(root, "release");
const target = join(release, `MVP-Tracker-${VERSION}-windows-x64`);
// Only replace this generated version's package; portable user data is never a source.
if (!target.startsWith(release + sep)) throw new Error("Unsafe package path.");
await rm(target, { recursive: true, force: true });
await mkdir(target, { recursive: true });
await copyFile(join(root, "dist/mvp-tracker/mvp-tracker-win_x64.exe"), join(target, "MVP Tracker.exe"));
await copyFile(join(root, "dist/mvp-tracker/resources.neu"), join(target, "resources.neu"));
await cp(join(root, "extensions"), join(target, "extensions"), { recursive: true });
for (const file of ["README.md", "LICENSE.txt", "THIRD_PARTY_NOTICES.md", "dependency-provenance.md"]) await copyFile(join(root, file), join(target, file));
await cp(join(root, "resources/licenses"), join(target, "licenses"), { recursive: true });
const source = join(target, "source"); await mkdir(source, { recursive: true });
// Corresponding source is carried with the unsigned portable artifact.
for (const file of ["src", "native", "scripts", "tests", "docs", "licenses", ".gitignore", ".gitattributes", "package.json", "bun.lock", "tsconfig.json", "neutralino.config.json", "README.md", "LICENSE.txt", "THIRD_PARTY_NOTICES.md", "dependency-provenance.md", "plan.md"]) await cp(join(root, file), join(source, file), { recursive: true });
const zip = `${target}.zip`;
const child = Bun.spawn(["powershell.exe", "-NoProfile", "-File", join(root, "scripts/zip.ps1"), "-Source", target, "-Destination", zip], { stdout: "inherit", stderr: "inherit", windowsHide: true });
if (await child.exited) throw new Error("ZIP packaging failed.");
console.log(`Portable package: ${zip}`);
