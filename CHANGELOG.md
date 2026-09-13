# Changelog

## 0.1.9.1

- Preserve capture context across map notifications, unrelated connections and initial game discovery; extend bounded early-grave buffering and age replay suppression.
- Add experimental ground X/Y coordinates and positive-health Alive sightings, with bounded joins, expiry and separate Capture toggles.
- Preserve new evidence through local saves, full exports and Convex; upgrade sharing to protocol 3 without resetting data.
- Narrow Level/Region/CH columns and enlarge status text while keeping rows compact.
- Add anonymous experimental counters, capture regressions and evidence lifecycle tests.

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
