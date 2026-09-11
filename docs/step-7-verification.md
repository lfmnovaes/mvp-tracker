# Step 7 verification — 0.1.7

Date: 11 September 2026. Scope: the reported Step 6 Save failure and Step 7 manual/automatic Convex sync, Reset and expiry. Manual desktop/game/multiplayer testing remains primarily with the user.

## Reported Save failure

The backend assigned the request ID only after validating the request body. An empty key failed the old required-key validator before that assignment, so no error reply reached the waiting UI. The UI eventually displayed its generic backend timeout. This was a local request/reply failure, not evidence that the Convex URL was unreachable.

The backend now extracts a safe correlation ID before body validation, including detached network operations. Invalid requests receive an immediate sanitized error. Empty keys are valid; URL-only mode is supported when MVP_GROUP_KEY is unset/empty on the deployment. Unknown character names upload as null. Both Save connection and Save settings persist the connection before background setup checks, and Sharing drafts survive switching tabs.

A read-only `timers:testConnection` query to the deployment supplied by the user returned a missing-function error. No tracker functions were deployed there at verification time. No live initialization, upload, Reset or deployment was performed. The owner must deploy the matching source once; see [Convex setup](convex-setup.md). Save/first Sync can then initialize dataset metadata without clearing timers. A URL alone cannot deploy schema/functions.

## Implemented behavior

- One coordinator serializes manual/F9 and automatic sync with 10s/20s/30s/1m/2m/5m intervals. Start syncs immediately; automatic mode starts stopped after launch. Manual requests coalesce during active work, including connection-change drainage. Interval changes apply without restarting the app; Stop cancels future work, sleep avoids catch-up bursts, and temporary errors back off.
- Merged observations, revision state and acknowledgements persist together. Capture/edits during upload remain pending; unchanged polls avoid disk rewrites. Sender identity is snapshotted per request. Unselected remote rows remain untouched.
- Reset confirms the destination, stops scheduling, drains active sync and persists its request ID before the mutation. Response-loss retries use the same ID. Generation/cutoff checks prevent stale clients or imports repopulating pre-reset kills. The UI allows sufficient response time for drainage/recovery.
- Coalesced scheduled cleanup removes expired payloads without an active client. Generation/token checks protect against stale jobs. Cleared slots remain visible as labels.
- Open logs uses the absolute Windows Explorer executable instead of depending on PATH. Clear logs removes only known rotated application logs. More detailed sanitized diagnostic context is recorded in the Step 8 plan.

## Automated verification

`bun run check`: TypeScript, 61 Bun tests (desktop/domain/transport) and 10 Convex tests pass. Focused coverage includes invalid-body correlation IDs, connection persistence and validation, optional/null attribution, concurrent merge, scheduled cleanup, atomic acknowledgement persistence, capture during sync, queue coalescing, live intervals, stop/sleep/backoff, old connection replies, and durable reset retries after network/disk/generation failures. Log clearing preserves unrelated files and subsequent logging works.

Convex tests use convex-test with a mocked runtime and fake timers. They do not establish real service latency, transaction retry frequency or free-plan capacity. No user capture process was launched or stopped for verification.

Measured JSON bytes from realistic mock fixtures:

| Slots | Candidate upload | Full response | Unchanged response |
|---|---:|---:|---:|
| 42 | 10,837 | 20,276 | 170 |
| 594 | 142,309 | 263,292 | 171 |

These are serialized fixture payloads, excluding HTTP/TLS overhead; they are not billed bandwidth measurements. At 10-second intervals, monthly invocation counts can dominate despite small idle responses.

The local portable package is built with `bun run package`. Runtime resources, bundled executables, matching Convex source, tests and setup/verification documents are included; local credentials/data/logs and dependency caches are excluded. Automated tagged release publishing remains Step 9.

## User validation still pending

Deploy matching functions to the selected cloud development deployment, then verify Save/restart persistence, initial setup, anonymous/keyed sync, two-player convergence, manual Sync during automatic mode, interval changes and confirmed Reset. Use a separate disposable deployment for destructive race tests. Verify the Explorer log folder opens and Clear logs works in the packaged app. Capture/tray/sleep/DPI and clean-machine portable checks remain in the Step 8 matrix. None of those manual checks are claimed as completed here.
