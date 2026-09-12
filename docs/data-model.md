# Data and runtime model

## Components

Preact UI → validated IPC → Bun backend. Native C# handles tray, hotkeys and physical window placement; Neutralino hosts the window. Capture/character adapters supply graves and local identity. One timer store and sync coordinator own persistence/merging. No reward/combat collectors run.

Portable state: data/settings.json (preferences), data/sharing.json (URL), data/timers.json (slots and durable sync state), data/window.json (normal bounds/monitor). Atomic saves preserve consistency. Expired evidence is discarded on normal reads/writes; read-only storage is reported without an AppData fallback.

## Convex audit — 0.1.9

All three custom tables and their fields are used. No schema migration or field removal is needed.

| Table / field | Use |
|---|---|
| trackerMeta.singleton | Indexed singleton lookup |
| schema, catalog | Compatibility checks |
| datasetId | Stable deployment dataset identity |
| generation, resetAt | Reset boundary; rejects stale clients and pre-reset kills |
| revision | Monotonic change cursor, once per changed transaction |
| prunedRevision | Forces a full snapshot when physical deletions invalidate older deltas |
| nextExpiry | Earliest active expiry; avoids scanning all rows on idle polls |
| cleanupJob, cleanupToken | Cancel superseded scheduled cleanup; reject stale jobs |
| bossTimers.key | Canonical mobId/region/channel slot key and indexed lookup |
| mobId, region, channel | Validated readable identity; duplicated in evidence for self-contained exports |
| observation | Optional current evidence, detailed below |
| outdated | Retained expired slot label after evidence is cleared |
| revision | Changed-row index for delta downloads |
| expiresAt | Indexed kill time +150 minutes; scheduled cleanup query |
| resetReceipts.requestId | Indexed idempotency key for retries after a lost Reset response |
| datasetId, expectedGeneration | Bind receipt to the original reset target |
| generation, resetAt, revision | Return the original reset result without clearing newer data |

resetReceipts is bounded to the latest 32 entries, indexed by reset time. Removing it would permit a retry to clear fresh observations. Older evicted retries fail the generation check. Convex's _scheduled_functions is platform-managed scheduler state. Every document also has automatic _id (used for patch/delete) and _creationTime fields; these cannot be removed from the schema. The catalog bounds bossTimers to 594 slots (42 with default selection).

## Observation fields

| Field | Meaning |
|---|---|
| mobId, region, channel | Slot identity |
| observationId | Evidence identity/deduplication, indexed to detect conflicting reuse |
| diedAt | UTC kill timestamp; controls spawn window and expiry |
| gatheredAt | UTC time evidence was obtained; controls freshness/merge |
| source, timePrecision | Capture/manual provenance and timestamp precision |
| killedBy | Optional killer |
| observedByCharacter | Optional original observer |
| instanceId | Optional capture instance/context provenance |
| replacesObservationId | Optional edit provenance; does not bypass freshness rules |
| submission.submittedByCharacter | Optional forwarding character, snapshotted per accepted request |
| submission.serverAcceptedAt | Server receipt time, separate from gatheredAt |

Unknown names are nullable/absent; they are attribution, not authentication. Original killer/observer and accepted submission metadata survive sync/full exports. Identical resends do not replace attribution. Expiry intentionally removes observation and expiresAt; an empty dashboard field then means the row is only an outdated label.

Revision is not a polling counter. New evidence (including a newer gathered time), expiry, reset and actual deletion advance it; identical observations and no-change polls do not. Delete outdated removes expired placeholders locally/remotely and rechecks current data transactionally. Local trash removes only the local row; it can return on later shared sync.

## Sync

One mutation merges pending selected evidence against current server rows and returns revision deltas. Omitted/unselected slots are preserved. Client evidence, acknowledgements and cursor persist together. A new connection/generation forces discovery; late replies from an old connection are ignored. Reset IDs persist before sending, and retries reuse them. Server scheduler clears expired evidence even with no open client.
