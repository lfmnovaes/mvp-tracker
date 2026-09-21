# Changelog

## 0.1.9.3

- Updated Spirit Vale capture to 3.0.3 for the September 21 game protocol, matching Spirit Vale Overlay.
- Updated compatible character catalogs: items 0.1.12 and skills 0.2.5.
- Added a wire-packet regression test for current channel decoding and gravestone ingestion.
- Updated the capture version shown in Diagnostics.

## 0.1.9.2

- Fixed fresh grave observations becoming Outdated during sync after a database Reset.
- Fixed capture context loss across map notifications, unrelated transports and initial game discovery.
- Extended early-grave buffering to 30 seconds and added replay aging.
- Added experimental X/Y ground coordinates, with Not located when unavailable; narrowed Level, Region and CH columns.
- Enlarged status text while keeping rows compact.
- Limited row highlights to Gathered at changes and extended them to three seconds.
- Added Settings → Colors with six intervals; default three minutes per color across the fixed ten-color palette.
- Removed living-boss detection and safely discard its retired data.
- Updated Convex reset filtering and coordinate sharing: run **npx convex dev --once** and upgrade all sharing clients; no Reset needed.
- Added regression tests for sync data loss, capture context, coordinates, color settings and migration.

## 0.1.9

- Add 5-second auto-sync; migrate the removed 5-minute interval to 2 minutes.
- Separate Hotkeys, Capture and Diagnostics settings.
- Add safe capture/error reasons and exception context to logs.
- Split runtime and corresponding source downloads, verifying both in CI.
- Consolidate docs and the plan; collect pending acceptance/UX tests in Step 10.
- Audit database fields and document coordinate/live-boss feature proposals.

## 0.1.8.2
- Add Windows CI and manual dry runs; tagged builds prepare draft releases.
- Add portable checksums and a source/dependency/per-file hash manifest.
- Rebuild generated resources from scratch and refuse to overwrite a release folder containing user data.
- Add a paste-back diagnostic test plan, anonymous timer/revision/scheduler context and 42/594-slot performance checks.

## 0.1.8.1
- Persist window bounds and monitor; recover when a monitor is disconnected.
- Sort Spawned above Spawn window; highlight changed rows and color gathered-time freshness.

## 0.1.8
- Add sanitized structured diagnostics and automated portable inspection.

Earlier steps delivered capture, timer editing/import/export, Convex sync and outdated cleanup. See docs/plan.md; detailed historical reports remain in Git history.
