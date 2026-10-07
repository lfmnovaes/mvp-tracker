import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
/** Read build identity only; never retain Steam account IDs or modify game files. */
export function parseSteamBuild(text: string) {
  const value = (name: string) => new RegExp(`"${name}"\\s*"([^"\\r\\n]*)"`).exec(text)?.[1];
  if (value("appid") !== "3767850") return undefined;
  const branch = value("BetaKey");
  if (branch && branch !== "public") return { branch, ignored: true };
  return { branch: "public", buildId: value("buildid"), installedDirectory: value("installdir"), lastUpdated: value("LastUpdated") };
}
export async function installedGameInfo() {
  const steam = join(process.env["ProgramFiles(x86)"] ?? "C:/Program Files (x86)", "Steam");
  const libraries = new Set([steam]);
  try { for (const match of readFileSync(join(steam, "steamapps/libraryfolders.vdf"), "utf8").matchAll(/"path"\s*"([^"]+)"/g)) libraries.add(match[1]!.replaceAll("\\\\", "\\")); } catch {}
  for (const library of libraries) {
    try {
      const manifest = join(library, "steamapps/appmanifest_3767850.acf");
      if (!existsSync(manifest) || statSync(manifest).size > 64 * 1024) continue;
      const build = parseSteamBuild(readFileSync(manifest, "utf8"));
      if (!build || build.ignored) continue;
      const name = build.installedDirectory;
      if (!name || /[\\/:]/.test(name) || name === "." || name === "..") continue;
      const game = join(library, "steamapps/common", name);
      const fingerprints: Record<string, string> = {};
      for (const file of ["GameAssembly.dll", "SpiritVale_Data/il2cpp_data/Metadata/global-metadata.dat"]) {
        const source = join(game, file); if (!existsSync(source) || statSync(source).size > 256 * 1024 * 1024) continue;
        const hash = createHash("sha256"), stream = Bun.file(source).stream();
        for await (const chunk of stream) hash.update(chunk);
        fingerprints[file] = hash.digest("hex");
      }
      return { branch: build.branch, buildId: build.buildId, lastUpdated: build.lastUpdated, fingerprints };
    } catch { /* Recording still works when Steam/game files are unavailable. */ }
  }
  return { unavailable: true };
}
