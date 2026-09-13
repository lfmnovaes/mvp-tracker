# Verification

## 0.1.9.1

Both TypeScript projects and 106 tests (92 Bun +14 Convex) pass. New regressions cover map/auth/transport admission, initial process discovery, 30-second context joins, replay aging, malformed experimental data, bounded position/health joins, Alive expiry/merge/reset/acknowledgement, schema-1 migration and full-format round trips. No live capture success is inferred from synthetic fixtures.

Windows build, runtime/source archive verification and both tamper-rejection checks pass. The runtime still contains 15 files and three x64 executables; private state is excluded. Synthetic 25-iteration merge/search/compressed-export benchmark: 42 slots median 0.57 ms/max 2.78 ms; 594 slots median 3.97 ms/max 7.11 ms.

Upstream comparison and sanitized log findings are in [improvements](improvements.md). No game/UI control, live Convex deployment, Reset or log clearing was performed for this patch. The owner must deploy protocol 3; existing rows need no Reset. Live coordinate axes, positive-health coverage and intermittent misses remain in [Step 10](testing.md).

Release CI and draft evidence will be recorded after the tagged build.

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
