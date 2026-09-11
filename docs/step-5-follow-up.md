# Step 5 follow-up — 2026-09-11

Version remains 0.1.5; Step 6 will advance it to 0.1.6.

- A labeled trash icon removes one local slot and its persisted observation. The backend also discards any already-queued capture for that slot. A later fresh capture or import can add the slot again. Shared deletion is not implied.
- Settings schema 5 defaults to 24-hour time and migrates earlier schemas to that preference. Saving a subsequent AM/PM preference retains it. Time format helpers and startup placeholders also default to 24-hour time; compact text continues to use HH:mm.
- Gathered at displays HH:mm:ss by default. The full date/time remains in Details and its hover tooltip. Sorting continues to compare the full timestamp.
- Filters and the Add/Export/Import/Start/Sync toolbar are fixed in the window frame. The timer viewport scrolls, with sticky column headings. Empty and filtered-empty messages live in that viewport. The bottom status line retains timezone and character context.
- Horizontal window padding is slimmer. A new window defaults to centered 1080 × 820 instead of 1080 × 700. Saved position/size still take priority.

`bun run check` passes: TypeScript and 44 unit tests / 303 assertions. Added coverage checks slot deletion across restart, preservation of other rows, later re-ingestion, invalid deletion requests, one-time clock migration and both clock formats. Existing exchange/capture/storage tests continue to pass. Manual desktop layout, scrolling and live capture checks are left to the user.

## Header status reference

The rightmost status describes communication between the interface and the local backend:

| Label | Meaning |
| --- | --- |
| Starting… | No backend snapshot has been received yet. |
| Shell ready | The interface has received a backend response or state update. |
| Backend reconnecting… | A snapshot was received previously, but a later heartbeat failed. Requests keep retrying; this label does not mean the backend process is automatically restarted. |

The interface polls every five seconds with one heartbeat in flight at a time. Shell ready does not establish that capture, game detection, tray or storage are healthy; those have separate indicators and diagnostics.

| Capture label | Meaning |
| --- | --- |
| Capture status unavailable | Backend communication is unavailable. |
| Capture starting | The capture service is starting. |
| Capture active | Capture is running, without the waiting/stalled conditions below. |
| Waiting for game packets | The game is detected but no decoded game packet has arrived this capture session. |
| Capture stalled | The game is detected and the latest decoded packet is more than 90 seconds old. Recovery may quickly change this label. |
| Capture inactive | Capture is stopped or unavailable; details are in Capture settings and the status tooltip. |

Game detection shows **Game running** when detected, **Waiting for game** when the process is absent, or **Game detection unavailable** when detection or backend communication is unavailable.
