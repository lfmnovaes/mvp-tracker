# Step 7 review and outdated-row cleanup

Reviewed the implemented Step 0–7 path: portable settings/local storage, capture mapping, manual editing, clipboard exchange, URL-only Convex setup, transactional sync, reset/retry and scheduled expiry. Implementation is complete. Step 8's user-led live capture/multiplayer/Windows validation and richer logs, and Step 9 release automation remain pending.

## Findings

A read-only snapshot of the configured Convex deployment showed 15 outdated rows with no active observation. The local saved file contained 15 observations with killer, observer and gathered timestamps, but all 15 kill timestamps were already at least 150 minutes old. Cleared remote payloads were consistent with the expiry policy. No live upload, Reset or cleanup mutation was run; player names were not printed in diagnostics.

The persisted observation schema already includes killer, original observer, kill/gathered timestamps, source/precision, optional instance/replacement information, and submitting character/server acceptance time. A regression assertion compares the stored object with the complete input evidence. Missing optional values remain optional; no identity is fabricated.

`expiresAt` is the indexed kill-plus-150-minute timestamp used by scheduled cleanup. Automatic expiry clears it and the observation, discarding obsolete personal data but retaining an Outdated label. The manual cleanup button supplements this scheduler.

Revision previously incremented for each changed row in a transaction, so large uploads or grouped expirations caused large jumps. It now increments once per changed transaction, with every affected row sharing that cursor. Identical re-sends and empty polls preserve the stored rows, attribution and revision. New gathered timestamps are new evidence and legitimately advance revision.

## Delete outdated

The fixed-footer button checks all local rows and configured remote slots, independent of filters/selection. Current observations are preserved. Local-only cleanup works without a URL. The server compares actual kill timestamps in its transaction, protecting fresh observations written before it executes. Capture arriving during the request is merged before applying its result.

Cleanup serializes with manual/automatic sync. On a new connection it discovers metadata and cleans without uploading local evidence. Local deletion persists if the remote operation fails; the UI reports the partial failure. Repeated cleanup with no expired rows changes neither records nor revision. Reset generations reject stale requests.

An optional `trackerMeta.prunedRevision` watermark forces a full snapshot for cursors predating physical deletions. Its response tells updated clients to discard outdated labels while retaining current local observations. No history table or unbounded deletion list is needed. Older desktops must be updated to apply this cleanup hint.

## Verification

Both TypeScript projects and 79 tests pass: 67 Bun tests and 12 Convex tests. Focused cases cover complete stored evidence, one revision per batch, unchanged record bytes on duplicate sync, cleanup before scheduled expiry, all-region cleanup, idempotence, old-cursor refresh, generation rejection, local persistence, new connections/network failures, and capture during queued cleanup. The Windows package is rebuilt and inspected. Button/desktop and multiplayer checks remain with the user.

Deploy with `npx convex dev --once` to add the cleanup mutation and optional metadata field. This compatible update needs no Reset. App version remains 0.1.7 because this is a Step 7 follow-up.
