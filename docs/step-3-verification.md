# Step 3 — Passive capture and health (0.1.3)

Implemented passive UDP capture for SpiritVale.exe with published capture 3.0.2 and character 0.6.1. No combat/reward collectors or packet logs are started. Captured observations flow into the existing validated, selected-scope TimerStore; memory changes are coalesced into atomic saves and UI publication on the existing one-second maintenance cycle. Exit flushes pending observations. Hiding the window does not stop capture.

## Behavior

- Existing grave spawn snapshots and fresh-kill SyncType decode through upstream. Kill timestamps are UTC instants from the wire, rounded to milliseconds; gathered timestamps use the local packet capture time, including when decoding/context is delayed. No timezone reinterpretation or synthetic freshness from timer ticks.
- Bounded replay fingerprints distinguish reliable retransmissions from new packets/revisits. Only relevant grave/context/local identity packets are fingerprinted; no raw packets are persisted. Cache holds at most 8,192 fingerprints per capture connection context.
- Early unknown-context graves remain unresolved in memory for up to 10 seconds, capped at 64 markers, awaiting ChannelList_T on the same connection. A boundary clears the buffer. Invalid or expired unresolved context is skipped rather than guessed. No persistence/import/export of unresolved entries in this step.
- Connection, authentication, character quit and direct map-transition boundaries clear stale region/channel context. Normal object despawn and silence do not infer a boss respawn. Existing timer expiry rules remain authoritative.
- Only outbound local-object pinning plus StatusComponent identity updates supply a live observer. Inspected players/callbacks are excluded. Object replacement clears live identity. The last detected name is marked cached for the current session; sharing identity preference is live, then cached, then an explicit manual fallback. Only the live name is stamped as the automatic observer. Actual sending/persisted sharing identity belongs to Steps 6–7.
- Capture Settings provides automatic/manual adapter selection, refresh/retry, game/adapter/latest packet health, unresolved/skipped counts and an optional manual character fallback. Preferences migrate schemas 1/2 to 3 without losing previous choices.
- Missing Npcap, no adapter, permission/open errors and runtime failures leave the shell usable. Retry backoff is 5/10/20/40/60 seconds (capped); warning categories are throttled to once per minute. No game absence log flood. Sleep/clock changes reopen capture; 90 seconds without decoded traffic while the game runs triggers recovery. Lifecycle operations are serialized; Stop wins over an in-flight startup.

## Automated checks

- `bun run check`: TypeScript and 31 tests / 187 assertions pass. Includes synthetic spawn/SyncType, replay/revisit timestamps, unknown/invalid slots, connection/context resets, local vs inspected identity, changed local object, early context buffering, Npcap failures/backoff, native runtime failure, privacy of error messages, adapter changes, startup/stop race, game exit, silence/sleep recovery and settings migration. Existing domain, persistence, logging and transport tests continue to pass.
- Windows x64 build and portable packaging: version 0.1.3 must match package.json, Neutralino configuration and shared protocol; backend bundles the capture runtime without external package imports. End users need no Bun/Node/package installation. Npcap is not redistributed.
- The versioned portable ZIP is assembled without local data/logs/secrets/node_modules and carries app source, dependency references and license notices.

## Deferred to user testing

No live game capture or routine manual desktop interaction was performed for this step. Synthetic tests prove adapter/lifecycle logic against the documented API; they do not prove current game wire compatibility or Npcap behavior on a particular adapter.

When testing later, check: Npcap setup and adapter selection; fresh kill and existing grave; revisiting the same grave; actual packet cadence while standing nearby; SA/NA channel changes; local character detection and character switch; capture in tray; game restart and Windows sleep; a portable ZIP on Windows 11 x64. Share essential event logs if a failure occurs, never raw game traffic by default. Missing a gravestone before context is known may require revisiting it after changing maps/channels.
