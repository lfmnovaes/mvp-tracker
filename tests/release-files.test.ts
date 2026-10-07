import { expect, test } from "bun:test";
import { allowedReleasePath } from "../scripts/release-files";
test("release inventory rejects private state, traversal and unexpected binaries", () => {
  for (const path of ["../data/settings.json", "source/.env.local", "logs/mvp-tracker.log", "source/data/window.json", "source/.git/config", "extensions/extra.exe", "source/scripts/helper.exe", "C:/secret", "source\\.env.local", "source/src/sharing-secrets.json"]) expect(allowedReleasePath(path)).toBe(false);
  for (const path of ["MVP Tracker.exe", "HELP.txt", "NOTICE.txt", "extensions/backend/index.js", "extensions/backend/recording-worker.js", "licenses/Bun-LICENSE.txt", "release-manifest.json"]) expect(allowedReleasePath(path)).toBe(true);
  for (const path of ["README.md", "docs/overview.md", "source/package.json", ".env.local.sample"]) expect(allowedReleasePath(path)).toBe(false);
  for (const path of [".env.local.sample", ".github/workflows/windows.yml", "native/WindowPlacement.cs", "scripts/package.ts", "docs/overview.md"]) expect(allowedReleasePath(path, true)).toBe(true);
  for (const path of ["THIRD_PARTY_NOTICES.md", "CHANGELOG.md", ".env.local", "data/settings.json", "src/secrets.json", "native/helper.exe", "../package.json"]) expect(allowedReleasePath(path, true)).toBe(false);
});
