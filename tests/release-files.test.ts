import { expect, test } from "bun:test";
import { allowedReleasePath } from "../scripts/release-files";
test("release inventory rejects private state, traversal and unexpected binaries", () => {
  for (const path of ["../data/settings.json", "source/.env.local", "logs/mvp-tracker.log", "source/data/window.json", "source/.git/config", "extensions/extra.exe", "source/scripts/helper.exe", "C:/secret", "source\\.env.local", "source/src/sharing-secrets.json"]) expect(allowedReleasePath(path)).toBe(false);
  for (const path of ["MVP Tracker.exe", "source/.env.local.sample", "source/.github/workflows/windows.yml", "source/native/WindowPlacement.cs", "source/scripts/package.ts", "licenses/Bun-LICENSE", "release-manifest.json"]) expect(allowedReleasePath(path)).toBe(true);
});
