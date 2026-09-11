# Step 8 — validation and diagnostics (0.1.8)

**Engineering checks complete; user acceptance remains pending.** No live game, multiplayer, real database Reset, or clean-machine test is claimed. See [the concise user checklist](windows-validation.md). No live cloud writes or owner deployment were performed for this step.

## Changes

Added structured diagnostic context: app version, severity, component/operation, safe UUID request ID, elapsed milliseconds, sanitized failure category, HTTP status and relevant row/revision counts. Invalid request-body failures now record the operation that failed without serializing its arguments. Connection timeout and cancellation are distinguished. Capture logs retain only allowlisted lifecycle/error events.

Repeated equivalent failures are throttled for 60 seconds with a bounded suppression count; routine no-change syncs create no transport or sync-success log records. Rotating logs remain five files of at most 2 MiB, retained seven days. Diagnostic exports preserve approved structured context and add Bun/Node/Windows/tool versions and anonymous sync/sharing status. Their schema is now 2.

Open logs launches the absolute Windows Explorer path and reports that opening was requested; visual folder appearance is left to the user check. Clear logs is unit-tested to remove only known files and allow logging afterward. No additional desktop windows were opened for automated verification.

## Automated coverage and environment

- Both desktop and Convex TypeScript configurations pass; 81 tests pass (69 Bun + 12 Convex). Existing coverage exercises capture decoding/lifecycle, fixed-zone time boundaries, migration/atomic storage, manual/clipboard flows, sync concurrency, expiry/reset generations, response-loss recovery, and deletion refresh.
- New diagnostics tests cover useful context, arbitrary-field/name/path redaction, UUID validation, 60-second throttling, clear/restart logging, service error categories and quiet unchanged syncs. Existing rotation/age/size bounds remain checked.
- Build host: Windows 11 Pro x64, OS 10.0.26200/build 26200; .NET release value 533509. Bun 1.4.2, Node v24.21.0, TypeScript 7.0.2, Neutralino runtime/lib 6.9.0 and CLI 11.7.2. Capture 3.0.2, character 0.6.1, Convex 1.45.0.
- Portable build and ZIP verification check required executables/resources/source/notices, source version agreement, all three executable PE headers as x64, absence of local data/logs/environment configuration, and SHA-256. `scripts/verify-portable.ps1` can repeat the inspection without launching the app.

Run from PowerShell after packaging:

```powershell
powershell -NoProfile -File scripts/verify-portable.ps1 -ArchivePath release/MVP-Tracker-0.1.8-windows-x64.zip
```

The reported earlier Save failure is covered by request-ID-before-validation tests and the deployment-specific TypeScript check. Earlier real database expiry observations were read-only and documented in Step 7; unit fixtures do not establish live Convex latency, quota usage or conflict retry frequency.

## Pending acceptance

User checks: Open/Clear logs in the actual app, live grave/revisit and identity/context transitions, two-player sync and actual races, tray/hotkeys and Explorer restart, sleep/resume, 125–200% DPI, portable upgrade, and startup/Exit on another clean Windows 11 x64 installation. Record results before declaring the private-group release validated. Step 9 remains release automation, not part of this change.
