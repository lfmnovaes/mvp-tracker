# Step 4 — Local tracker and Settings flows (0.1.4)

## Implemented

- Add manually from the footer or F8. Choices use only selected bosses and regions; bosses sort by level descending/name ascending, channels are exactly 1–3. Date includes Today/Yesterday shortcuts, time uses explicit AM/PM by default or 24-hour text, optional seconds and optional killer. Preview uses the fixed São Paulo timezone and displays the full kill timestamp and +60/+90 spawn window.
- Every known row has Edit and Details. Edit fixes boss/region/channel. Details exposes kill/gathered timestamps, source, observer and guaranteed spawn time. Outdated details disclose that old values were discarded. No historical record is retained for the view.
- The typed Save request validates fields, rejects edits that change slot identity, strips caller-supplied timestamps/source/observer and applies backend-confirmation time. Pending capture observations flush before manual Save. Manual save is independent of capture and sharing. Invalid/future entries reject; an explicitly expired entry clears the slot to Outdated. Selection is rechecked by the domain at Save.
- Explicit region and channel filters complement search and sortable headers. Keyed row components retain Details state. Automatic row movement is deferred while row actions have keyboard focus. Dialog draft state initializes once per opening, so live snapshots do not overwrite input. Native modal dialogs, associated labels, buttons and form submission provide keyboard access; Escape/Cancel closes without saving and Save disables duplicate submission.
- Interface scale choices 80/90/100/110/125%, persisted as settings schema 4 with migration from schemas 1–3. Existing tray/hotkeys/window bounds/start-hidden/timezone/selection settings remain available. Window bounds continue to use Neutralino persistence.
- Capture strip distinguishes waiting for packets, stalled capture and an unavailable backend. A bounded single-flight heartbeat refreshes backend status. F9 explains that sharing is unavailable; export/import/sync/start controls remain disabled until their implementation steps.
- Open logs launches the fixed portable log directory. Copy diagnostics builds a report using allowlisted fields and event codes; private settings, names, killer/observer data, native error strings, adapter descriptions and paths are excluded. Optional health sampling collects at most 30 summaries over five minutes, stops on clock rollback or expiry, stays in memory, and requires an explicit copy to export.

## Automated checks

`bun run check` passes: TypeScript plus **36 tests / 260 assertions**. The five new focused tests cover caller evidence stripping/slot restrictions, selected boss ordering and clock-format round trips, expired/future/invalid/deselected manual entries, settings migration/scale bounds and diagnostic privacy/caps. Existing capture, core merge/expiry, storage, log rotation and transport tests continue to pass.

Windows x64 build and portable package use matching 0.1.4 metadata. Package verification checks the executable, Neutralino resources, bundled Bun/backend/native helper, corresponding app source and license notices, and excludes local data/logs/node_modules/research/secrets. No new runtime dependencies were introduced.

## Manual checks deferred to the user

No desktop automation or live game interaction was performed for this step, following the agreed testing policy. Type checks/domain fixtures and source review are not a claim that Windows keyboard navigation, modal focus restoration, UI scaling or real capture interaction have been exercised.

Later user testing: Add with AM/PM/24-hour formats and optional seconds; Edit with an incoming capture update; Today/Yesterday around midnight; future/invalid date rejection; expired clearing; Cancel/Escape and repeated F8; table focus during status changes; all scales at minimum window dimensions; read-only portable folder warnings; Open logs/Copy diagnostics; tray and restored window bounds. Clipboard timer formats and Convex sharing are still Steps 5–7.
