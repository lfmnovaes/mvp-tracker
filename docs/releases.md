# Windows release routine

## Build locally

From a clean Windows x64 checkout with Bun 1.4.2, Node 24.21.0 and .NET Framework's C# compiler:

```powershell
bun install --frozen-lockfile
bun run setup
bun run check
bun run benchmark
bun run package
powershell -NoProfile -File scripts/verify-portable.ps1 -ArchivePath release/MVP-Tracker-0.1.8.2-windows-x64.zip
```

The ZIP includes corresponding source, licenses, docs and `release-manifest.json`. Beside it are `.manifest.json` and `.sha256` files. The manifest records source commit/dirty status, pinned dependencies, runner/runtime versions and every packaged file's hash (except the manifest itself). The checksum file covers the ZIP and external manifest. Hashes detect changes; this is an unsigned release, not a signature-based authenticity system.

`bun run package` rebuilds generated resources and excludes local settings/logs/credentials. It refuses to replace an extracted release directory containing `data/` or `logs/`; move that user copy first. Build artifacts are reproducible from the pinned inputs, but ZIP timestamps, compiler metadata and runner-image updates mean byte-for-byte identical ZIPs are not promised.

## GitHub Actions

**Windows portable** runs on pushes to main, pull requests, and Actions → Run workflow. The manual run is a dry run: checks/build/verification plus an artifact retained seven days; it never creates a release. CI uses a clean `windows-2025` runner (Windows Server, not a Windows 11 interactive acceptance test). Build jobs have read-only repository permissions. Actions are pinned to verified commit SHAs.

The workflow mirrors the relevant stages of [the upstream workflow](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/.github/workflows/release.yml). [GitHub trigger documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow) describes branch/tag/manual events. [Bun setup](https://github.com/oven-sh/setup-bun) supplies the pinned runtime.

## Prepare and publish a version

1. Update package/config/protocol version, CHANGELOG and docs/release-notes.md; run checks, commit and push.
2. Run the manual workflow and inspect its artifact. Complete [user acceptance](test-report.md), including a clean Windows 11 launch/Exit.
3. Tag the accepted commit: `git tag app-v0.1.8.2` then `git push origin app-v0.1.8.2`. The same pipeline verifies tag/version agreement, rebuilds, and creates a **draft** GitHub release with ZIP/manifest/checksums. Only its release job has contents:write; it never overwrites existing assets. A draft may also be prepared before acceptance, clearly labeled pending.
4. Record acceptance in the release notes and publish the draft in GitHub when ready. No token, signing key or Convex credentials need to be added to repository secrets. Desktop publishing never deploys or resets Convex.
5. For a defect, make a new patch; do not retag or silently replace published artifacts. Roll back by extracting the prior compatible ZIP into a separate folder with a copy of data/ made while the app was exited.

If CI fails, use the failed job's logs. If a draft already exists, do not delete it automatically: inspect its commit/assets first. Keep 0.1.8 available as the earlier local rollback build.
