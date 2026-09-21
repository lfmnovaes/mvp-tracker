# Verification

## 0.1.9.3

Both TypeScript projects and **103 tests** (89 Bun +14 Convex) pass with capture 3.0.3, items 0.1.12 and skills 0.2.5. A new synthetic wire test exercises the September 21 ChannelList_T hash through the installed decoder and tracker, including correct SA/channel/kill/killer attribution. Upstream boss IDs, names and levels are unchanged; protocol 4/schema 2 remain unchanged, so upgrading from 0.1.9.2 needs no Convex deployment.

Windows build, runtime/source verification and both tamper checks pass: 15 runtime files, 97 source files, three x64 executables, no private state. Synthetic 25-iteration benchmark: 42 slots median 0.78 ms/max 3.52 ms; 594 slots median 5.17 ms/max 7.31 ms. Neutralino runtime/lib 6.9.0, neu 11.7.2 and Preact 10.29.8 were verified as current stable releases and retained.

No live game capture or manual desktop control was performed. Release publication is explicitly requested for this compatibility patch; the broader Step 10 acceptance matrix remains pending. CI and release evidence follow after publishing.

## 0.1.9.2

The sync data-loss regression was reproduced before implementation: both the desktop sync test and the Convex test failed because fresh post-reset observations with pre-reset kill times were discarded. Both passed after changing the cutoff to gatheredAt. Desktop coverage exercises manual and automatic sync; pre-reset evidence remains rejected.

Both TypeScript projects and **102 tests** (88 Bun +14 Convex) pass. Coverage includes coordinate joins/validation, retired-data migration, matching protocol, configurable ten-color bands and three-second animation triggers that ignore status/submission changes.

Windows build and archive verification pass: 15 runtime files, 96 source files, three x64 executables and no private state. Both tampered runtime/source archives are rejected. Synthetic 25-iteration benchmark: 42 slots median 0.45 ms/max 2.48 ms; 594 slots median 3.25 ms/max 5.18 ms.

[Clean push CI](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34750474668) and the [tagged build/release job](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34750557275) passed at 29259b3, tag app-v0.1.9.2. GitHub initially returned HTTP 500 after creating an empty draft; only that empty draft was removed, and the failed release job succeeded on retry using the verified artifacts.

The [draft release](https://github.com/lfmnovaes/mvp-tracker/releases/tag/untagged-7678a8bf210aefc5bc76) has four assets: runtime ZIP (41,249,186 bytes), source ZIP (214,369 bytes), manifest and checksums. CI runtime SHA-256: 1a6bf00a23fac5f26f11da2dc01d5255309b9768574cf1d7f4572ffcdce1acd4. The clean local runtime has SHA-256 616dc2e751ac8df29a66d6439ba76872a701318631589e558b4e063089868d0a. This evidence-only update follows the tag; verified assets remain unchanged and unpublished.

0.1.9.1 was withdrawn: its GitHub release/assets, remote/local tag and local release archives/staging were removed. Implementation history is retained. No game/UI control or live Convex deployment/Reset was performed. Live capture and coordinate validation remain in [Step 10](testing.md).

## 0.1.9

Both TypeScript projects and **88 tests** (76 Bun +12 Convex) pass. Added coverage for 5-second scheduling/coalescing, old 5-minute preference migration, safe capture/error context and runtime/source file exclusions. No Convex schema/functions changed.

Windows build and archive verification pass: 15 runtime files, three x64 executables, matching source archive, matching versions/hashes and no private state. Tampered runtime and source content are both rejected. Synthetic 25-iteration merge/search/compressed-export benchmark: 42 slots median 0.42 ms/max 2.00 ms; 594 slots median 3.14 ms/max 4.38 ms. These are local fixture measurements, not live service latency.

Documentation was reduced to nine focused files, with the root plan moved into docs. Relative documentation links resolve. The existing application log (141,904 bytes) was cleared; settings, timers and the remote database were preserved.

[Clean push CI](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34687191217) and [tagged build/draft job](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34687261496) passed at 0eba047, tag app-v0.1.9. The [draft release](https://github.com/lfmnovaes/mvp-tracker/releases/tag/untagged-5db3d42d39355a9682c0) has four assets: runtime ZIP (41,246,811 bytes), source ZIP (204,805 bytes), external manifest and checksums. CI runtime SHA-256: c462fec3a732cb4dd66c2b63ab97e1b54a6cb11e20b7ab39caf4f93d3a638f14. The clean local build uses the same commit and has its own checksum. This evidence-only update follows the tag; verified assets are unchanged and unpublished.

Interactive tests remain in [Step 10](testing.md). No live database Reset, capture session or clean-machine acceptance is claimed for this update.

## Baseline evidence

0.1.8.2: both TypeScript projects and 85 tests (73 Bun +12 Convex) passed. Synthetic 25-iteration benchmark: 42 slots median 0.61 ms; 594 slots median 4.76 ms. Tests cover timer/merge/expiry boundaries, atomic persistence/migration, capture fixtures/recovery, input/import bounds, sync queue/reset/delta rules, redaction and native window geometry.

[Clean push CI](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34659920408) and [tagged build/draft release](https://github.com/lfmnovaes/mvp-tracker/actions/runs/34659940944) passed at bb3858e, tag app-v0.1.8.2. The native compiler harness uses a 30-second startup timeout for cold CI. Archive checks validate three x64 executables, matching versions, file hashes and exclusion of private state.

Host: Windows 11 x64 build 26200, Bun 1.4.2, Node 24.21.0, Neutralino 6.9.0; capture 3.0.2, character 0.6.1, Convex 1.45.0. Earlier step-by-step reports remain in Git history.
