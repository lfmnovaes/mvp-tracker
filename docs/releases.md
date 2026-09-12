# Windows releases

Requires Windows x64, Bun 1.4.2, Node 24.21.0 and the .NET Framework C# compiler.

```powershell
bun install --frozen-lockfile
bun run setup
bun run check
bun run benchmark
bun run package
powershell -NoProfile -File scripts/verify-portable.ps1 -ArchivePath release/MVP-Tracker-0.1.9-windows-x64.zip
powershell -NoProfile -File scripts/test-package.ps1 -ArchivePath release/MVP-Tracker-0.1.9-windows-x64.zip
```

Keep both generated ZIPs together for verification.

| Asset | Contents |
|---|---|
| MVP-Tracker-VERSION-windows-x64.zip | Executable, resources, required backend/native runtimes, licenses, NOTICE.txt, HELP.txt and manifest |
| MVP-Tracker-VERSION-source.zip | Matching source, tests, docs, workflow, lockfile and build instructions |
| *.manifest.json | Source commit/dirty flag, build/dependency versions and hashes for both archives' files |
| *.sha256 | Checksums of both ZIPs and external manifest |

The runtime excludes docs, source and Markdown files. Required license notices remain; corresponding source is offered beside the binary. extensions/backend/index.js runs capture, storage and sync and must remain. No local data, logs, credentials or dependency cache is packaged. Packaging refuses to replace a versioned folder containing data/logs.

## CI and release

Windows portable runs for main pushes, PRs, manual dry runs and app-v* tags on windows-2025 with pinned actions/runtimes. It checks types/tests, benchmarks, builds, verifies both archives and rejects a tampered ZIP. Artifacts last seven days. Windows Server CI does not replace Windows 11 interactive acceptance.

1. Update package/config/protocol version, CHANGELOG and [release notes](release-notes.md). Use **What's Changed** followed by concise change bullets, matching [upstream releases](https://github.com/kar-mi/spirit-vale-overlay/releases); issue/PR links are optional.
2. Run checks, commit/push and verify clean CI.
3. Tag the verified commit (git tag app-v0.1.9; git push origin app-v0.1.9). A separate write-permitted job checks provenance/checksums and creates a draft with all four assets; it never overwrites an existing release.
4. Complete [Step 10](testing.md), record acceptance and publish the draft when ready. No deployment credentials or Convex changes are part of desktop publishing.
5. Ship a new patch for defects; never replace published assets silently. For rollback, Exit and use a separate compatible runtime with a copy of data/.

Unsigned hashes detect changes, not publisher identity. Pinned inputs support repeatable builds, but archive timestamps and runner/compiler metadata may differ.
