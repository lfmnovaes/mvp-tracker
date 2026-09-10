# Step 2 — Catalog, timer core and persistence

Version **0.1.2**, 2026-09-10. Early-step acceptance uses focused unit tests, TypeScript checks and the Windows build. Manual desktop testing is left primarily to the user at a later stage.

## Implemented

- The minimal catalog contains all 33 supported upstream bosses, sorted by level descending and name ascending. A one-time source comparison verified every ID/name/level against the pinned upstream catalog. Robot Dragon is absent. Suphara and Echo Weaver Master remain supported; Weaver is not part of Endgame.
- Tracking Settings has All / Endgame / None, the scrollable boss list, and six independent region checkboxes. The seven Dark Fortress Masters and SA/NA are the defaults. Other map labels remain blank where the source does not provide an association.
- Settings schema 2 migrates schema 1 while preserving startup, clock and shortcut preferences. Tracking selection and table sorting persist with the existing atomic settings writer.
- Pure domain code implements UTC timestamps, São Paulo conversion/formatting, manual input validation, deterministic slot identity, observation freshness, expiry, and search/sort. The tracker table consumes the real stored state; no fixture data is inserted into the app.
- Search handles case/accents and AND tokens such as `paladin sa ch2`, `dark fortress`, `region:sa`, `killer:luis` and `ch:2`. Channel terms cannot match levels or timestamps. Sort uses numeric/timestamp fields, never countdown text; selected sort is saved.
- `TimerStore` is the backend ingestion/manual-edit boundary for Steps 3–5. Selected observations survive restart in `data/timers.json`; deselected existing observations are retained until expiry but hidden, and incoming deselected records are ignored.

## Domain decisions

Waiting is age <60 minutes, Spawn window is 60–<90, Spawned is 90–<150, and Outdated begins at 150 minutes. Later checks change gathered time, never the kill's spawn/expiry boundaries. At expiry the stored observation is physically removed, including kill, gathered, killer and attribution values; only the slot and Outdated marker remain. Cleanup runs on startup, ingestion, reads, selection changes, shutdown and a lightweight clock-based interval, including while hidden.

All timestamps are UTC epoch milliseconds. Shared/captured timestamp validation allows at most **30 seconds** of future clock skew. A gravestone check beyond kill +90 minutes plus this tolerance is rejected as contradictory. Manual input rejects any future kill time. This tolerance does not change the 60/90/150-minute boundaries. Incoming records retain their original gathered time; receipt time is never substituted.

Freshest gathered time wins; equal times use a stable observation-ID ordering. Duplicate delivery is a no-op. Reusing an existing observation ID with different content rejects the batch. An observation is replaced as a whole, so killers cannot leak across deaths. Manual Save stamps the supplied current clock instant and may correct a kill backward or forward; newer automatic evidence may replace it.

Expired imported/captured data cannot overwrite an active observation. A deliberate local manual edit to an expired kill clears that local slot explicitly. It is not a shared per-row deletion; database operations remain in later steps.

Timer saves use flushed temporary writes and atomic replacement. A committed file wins over a leftover temporary; an orphaned valid temporary can recover if no committed file exists. Corrupt/unknown-schema originals are preserved and writes blocked, with a visible warning; observations can remain in memory. Failed writes retain dirty state for retry. Expired payloads are not retained in backup/history files. Logs record only fixed storage failure/recovery event names, not timer contents.

## Verification

`bun run check` runs strict TypeScript checking and the focused unit suite. New tests cover catalog exclusions/defaults, settings migration, noon/midnight/date rollover, exact lifecycle boundaries, merge convergence/idempotency, manual/capture replacement, stale-import protection, validation/skew bounds, deselection, restart expiry, interrupted writes, corrupt files, write retry, and search/sort behavior.

`bun run package` builds version 0.1.2 and creates the unsigned Windows x64 ZIP with corresponding source/notices. No desktop automation or live packet/database testing was performed for this step. Capture remains in Step 3; the full Add/Edit dialog, row actions and further interaction polish remain in Step 4; clipboard and Convex integration remain in later steps.
