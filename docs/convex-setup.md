# Convex sharing

See the [README](../README.md) for first setup and subsequent runs. Players use only a Convex URL saved in Settings; the owner deploys this repository's backend once and after backend updates.

## Owner configuration

Use a cloud development deployment so everyone reaches the same database. `npx convex dev --configure --dev-deployment cloud --once` selects the project, writes owner configuration and deploys schema/functions. Later use `npx convex dev --once`. A failed type-check can be retried with the latter command once dependencies/source are updated.

| Variable | Purpose |
|---|---|
| `CONVEX_DEPLOYMENT` | Keep the CLI-generated value in the owner's `.env.local`; it selects the deployment for code updates. |
| `CONVEX_URL` | CLI-generated client URL/reference. The desktop instead uses its saved Settings URL. |
| `CONVEX_SITE_URL` | HTTP-action URL; this project has no HTTP actions and does not use it. The CLI may generate it; leaving it is harmless. |

The optional [`.env.local.sample`](../.env.local.sample) contains an empty URL, not complete deployment credentials. Do not overwrite a configured `.env.local`. Never distribute owner login/deployment credentials. No environment file is loaded by the packaged desktop. [Project configuration](https://docs.convex.dev/production/project-configuration), [HTTP actions](https://docs.convex.dev/functions/http-actions).

Group keys and the separate integration-test environment/harness have been removed. URL-only requests use **sharing protocol 2**, so deploy matching source before testing this build. Character names remain optional; unknown senders are stored as null. An old MVP_GROUP_KEY environment variable is no longer read and may be removed from the dashboard.

## Settings

- **Save settings** stores the URL in `data/sharing.json` beside the executable and checks the deployed backend in the background. It can initialize missing tracker metadata without uploading or clearing observations. Empty URL disconnects. Existing `sharing-secrets.json` files migrate their URL and discard the old key file.
- **Test connection** is read-only: validates the saved URL, matching app/protocol/schema/catalog, initialization and clock. It reports missing functions separately from network errors. Save an edited URL before testing it.
- **Reset database** asks for confirmation showing the URL and dataset. It clears all shared tracker observations, retains the dataset identity/retry protection, restores tracker metadata, and stops automatic sync. It works after connection setup without first syncing local timers. Reset does not deploy code, delete schema/indexes or erase unrelated tables. A schema update still requires the owner command above. [Schemas are pushed during deployment](https://docs.convex.dev/database/schemas).

Anyone with the URL can read, upload and reset this tracker. There are no individual accounts or access roles. URL validation permits only HTTPS `.convex.cloud` origins, with an optional trailing slash; dashboard URLs and `.convex.site` are not accepted. Changing the URL cancels old requests and stops automatic sync.

## Sync and reset behavior

Manual Sync/F9 works alongside automatic mode. Start syncs immediately; intervals are 10s, 20s, 30s, 1m, 2m and 5m. The chosen interval persists, but automatic mode starts stopped each launch. Repeated clicks during an active sync produce at most one follow-up. Stop cancels future work; a current response may finish. Network/quota failures back off; incompatible data/backend versions pause automatic sync.

Only selected, unexpired observations upload. Server transactions merge the latest evidence, preserve other players' rows and return revision deltas. Sender identity is snapshotted per request; polling never refreshes gathered time. Local records and acknowledgements persist together, including edits/capture arriving during sync.

Expired payloads are cleared 150 minutes after kill time by scheduled cleanup, retaining slot labels. Reset advances generation and stores a bounded receipt. Lost-response retries reuse the same durable request ID, preventing accidental repeated clearing. Pre-reset kills cannot be replayed from old clients/imports; later kills remain eligible. The small amount of dataset/retry metadata is intentionally retained for those guarantees.

At continuous 10-second polling, one client makes about 259,200 scheduled calls per 30 days; at 1 minute, about 43,200, before retries/cleanup. Check deployment usage when choosing an interval. Mock payload measurements are recorded in [Step 7 verification](step-7-verification.md); they do not establish live platform limits.

## Validation and diagnostics

The footer's **Delete outdated** additionally deletes retained outdated rows locally and across the configured database, including unselected bosses/regions. It rechecks kill timestamps inside the server transaction and preserves current observations. Local cleanup works without a URL; remote failures are reported separately. Cleanup shares the sync queue. A deletion watermark makes clients with older cursors refresh their snapshots instead of keeping deleted outdated labels.

`observation` contains kill/gathered timestamps, killer, observer, source/precision, optional instance/replacement IDs and server submission attribution. `expiresAt` is the indexed expiry timestamp (`observation.diedAt + 150 minutes`) for scheduled cleanup. Both fields are intentionally absent after expiry. Open a current row's nested observation object in the dashboard to inspect its details.

`revision` is a shared change cursor, not a sync-call count or individual row's update count. It advances once per transaction that changes tracker data; all rows changed together share that revision. Identical observations and empty polls do not rewrite records or advance it. New gathered times, expiry, Reset and actual outdated-row deletion do. Existing revision numbers are not reset.

`bun run check` type-checks the desktop and `convex/tsconfig.json`, then runs Bun and convex-test unit tests without a cloud connection. The Convex config explicitly includes Node type definitions, as required for `process` with TypeScript 6+. Runtime group-key/environment reads are now removed as well. [Convex runtime typing](https://docs.convex.dev/functions/runtimes).

There is no `.env.integration.example` or integration command. Manual shared-database checks remain with the user; use an empty temporary deployment if testing destructive scenarios. No automatic test resets the group's real database.

Capture & diagnostics provides Open logs, Clear logs and Copy diagnostics. More detailed sanitized failure context is planned in Step 8. Local logs exclude raw packets, names, clipboard contents and private URLs. Convex's own dashboard logs are separate and may expose function arguments to trusted project operators. [Convex logs](https://docs.convex.dev/dashboard/deployments/logs).
