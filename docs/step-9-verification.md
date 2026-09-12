# Step 9 — release automation (0.1.8.2)

Step 8 review found no additional need to control the desktop app. The remaining acceptance checks require live observations. Added [a concise test/report template](test-report.md), explicit healthy/error expectations, and anonymous timer counts plus sync revision/queue/reset state in copied diagnostics. Existing redaction tests assert these retain no names, URLs or dataset IDs.

Local checks: both TypeScript projects and **85 tests** (73 Bun + 12 Convex) pass. Synthetic merge/search/compressed-export benchmark, 25 iterations: **42 slots median 0.61 ms / max 3.28 ms**, **594 slots median 4.76 ms / max 6.97 ms**. Compressed fixture sizes: 758 and 6,261 bytes. These are local synthetic measurements, not live provider traffic or latency claims.

Windows x64 build/package inspection verifies all three executable architectures, metadata versions, private-state exclusions, documentation links and every file hash in the manifest. The verifier also has a tampered-ZIP rejection check. Builds now recreate generated resources to exclude stale files, package explicit extension binaries, include corresponding source/workflows/licenses, emit external SHA-256 checksums and record source/dependency/runtime provenance. Existing user data/logs in the versioned package destination block replacement.

GitHub workflow: pushes to main, PRs and manual dry runs run the checks and retain artifacts seven days. Tags must match `app-v` plus the app version; a separate write-permitted job verifies downloaded checksums/provenance and creates a draft release without overwriting existing assets. Actions/runtime inputs are pinned. No cloud credentials, Convex deployment or Reset are used.

Initial [clean push build](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34659627158) and [manual dry run](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34659638937) passed. The first tagged attempt hit the native unit harness's five-second compiler-startup timeout; its limit was raised to 30 seconds without changing assertions. No draft/assets were created by that failed run; the newly created unpublished tag was updated to include the harness fix.

Final [clean push build](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34659920408) and [tagged build plus draft-release job](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34659940944) both passed at commit `bb3858e`, tag `app-v0.1.8.2`. The [draft release](https://github.com/lfmnovaes/mvp-tracker/releases/tag/untagged-d392dfa845cb96dd03d9) contains the ZIP (41,565,402 bytes), manifest and checksums. GitHub reports the CI ZIP SHA-256 as `8e4aa21ac9f48adfd2fabdab99151e8958f09be8fa3064faf97f35545b025c6b`. The locally built ZIP has its own checksum; OS/build metadata and archive timestamps can differ. The draft has not been published.

Step 9 automation is complete. Only local build folders/ZIPs for 0.1.8 and 0.1.8.2 are retained; their user data was not touched. Final evidence-only documentation updates may follow the tagged source commit without modifying the draft's verified assets.

Windows 11 clean-machine startup/Exit, actual tray/monitor/DPI/capture behavior and multiplayer acceptance remain with the user. The Windows Server CI runner is not a Windows 11 manual acceptance test; no public tested-release claim is made.
