import { createHash } from "node:crypto";
import { readdir, lstat } from "node:fs/promises";
import { join } from "node:path";

export function allowedReleasePath(path: string): boolean {
  if (path.includes("\\") || path.includes(":") || path.startsWith("/") || path.split("/").some(p => !p || p === "." || p === "..")) return false;
  if (path === ".env.local.sample" || path === "source/.env.local.sample") return true;
  if (/(^|\/)(data|logs|node_modules|research|\.git|\.convex|\.tmp)(\/|$)|\.env|secrets|\.tmp$|\.log$/i.test(path)) return false;
  if (["MVP Tracker.exe", "resources.neu", "README.md", "LICENSE.txt", "THIRD_PARTY_NOTICES.md", "dependency-provenance.md", "plan.md", "CHANGELOG.md", "release-manifest.json", "extensions/bin/bun.exe", "extensions/bin/mvp-shell.exe", "extensions/bin/icon.ico", "extensions/backend/index.js"].includes(path)) return true;
  if (/^(docs|licenses)\//.test(path)) return !/\.(exe|dll|so|dylib|zip)$/i.test(path);
  return /^source\/(src|native|scripts|tests|docs|licenses|convex|\.github)\//.test(path) && !/\.(exe|dll|so|dylib|zip)$/i.test(path)
    || /^source\/(vitest.config.ts|\.gitignore|\.gitattributes|package.json|bun.lock|tsconfig.json|neutralino.config.json|README.md|LICENSE.txt|THIRD_PARTY_NOTICES.md|dependency-provenance.md|plan.md|CHANGELOG.md)$/.test(path);
}
export async function inventory(root: string, relative = ""): Promise<{ path: string; bytes: number; sha256: string }[]> {
  const result: { path: string; bytes: number; sha256: string }[] = [];
  for (const name of (await readdir(join(root, relative))).sort()) {
    const path = relative ? `${relative}/${name}` : name, file = join(root, path), stat = await lstat(file);
    if (stat.isSymbolicLink()) throw new Error("Linked files cannot be packaged.");
    if (stat.isDirectory()) result.push(...await inventory(root, path));
    else {
      if (!allowedReleasePath(path)) throw new Error(`Unexpected package file: ${path}`);
      if (path === "release-manifest.json") continue;
      result.push({ path, bytes: stat.size, sha256: createHash("sha256").update(new Uint8Array(await Bun.file(file).arrayBuffer())).digest("hex") });
    }
  }
  return result;
}
