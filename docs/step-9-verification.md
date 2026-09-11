# Step 9 — release automation (0.1.8.2)

Step 8 review found no additional need to control the desktop app. The remaining acceptance checks require live observations. Added [a concise test/report template](test-report.md), explicit healthy/error expectations, and anonymous timer counts plus sync revision/queue/reset state in copied diagnostics. Existing redaction tests assert these retain no names, URLs or dataset IDs.

Local checks: both TypeScript projects and **85 tests** (73 Bun + 12 Convex) pass. Synthetic merge/search/compressed-export benchmark, 25 iterations: **42 slots median 0.61 ms / max 3.28 ms**, **594 slots median 4.76 ms / max 6.97 ms**. Compressed fixture sizes: 758 and 6,261 bytes. These are local synthetic measurements, not live provider traffic or latency claims.

Windows x64 build/package inspection verifies all three executable architectures, metadata versions, private-state exclusions, documentation links and every file hash in the manifest. The verifier also has a tampered-ZIP rejection check. Builds now recreate generated resources to exclude stale files, package explicit extension binaries, include corresponding source/workflows/licenses, emit external SHA-256 checksums and record source/dependency/runtime provenance. Existing user data/logs in the versioned package destination block replacement.

GitHub workflow: pushes to main, PRs and manual dry runs run the checks and retain artifacts seven days. Tags must match `app-v` plus the app version; a separate write-permitted job verifies downloaded checksums/provenance and creates a draft release without overwriting existing assets. Actions/runtime inputs are pinned. No cloud credentials, Convex deployment or Reset are used.

Clean GitHub dry-run and tagged-draft results will be recorded after the workflow is pushed. Windows 11 clean-machine startup/Exit, actual tray/monitor/DPI/capture behavior and multiplayer acceptance remain with the user. The Windows Server CI runner is not a Windows 11 manual acceptance test; no public tested-release claim is made.
