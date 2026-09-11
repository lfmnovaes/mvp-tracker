# Convex group setup — version 0.1.7

The desktop supports Save/Test connection, manual Sync, optional automatic sync and confirmed shared Reset. Players need only the portable app and a deployment URL. One owner must first deploy the backend source to Convex; pasting a URL cannot install functions or schema.

## Owner: prepare a cloud development deployment

1. Create/sign in to your account at [Convex](https://www.convex.dev/) and select the project intended for your group. Install Node.js and Bun on the owner's development machine.
2. Open PowerShell in the MVP Tracker source checkout and run:

   ```powershell
   bun install --frozen-lockfile
   npx convex dev --configure --dev-deployment cloud --once
   ```

   Sign in when prompted and choose your existing project and its cloud development deployment. Verify that the resulting `.env.local` identifies the same deployment URL you intend to paste into the app. Do not choose a local deployment for sharing across players. Subsequent backend updates use `npx convex dev --once` from this configured checkout. These commands deploy functions/schema without resetting tracker observations. [Convex dev CLI](https://docs.convex.dev/cli/reference/dev).
3. A group key is optional. For URL-only access, leave the deployment environment variable **MVP_GROUP_KEY** unset or empty. To require a key, set it in Dashboard → Settings → Environment Variables to a random 32–128-character value containing letters, digits, `_` or `-`, and share that key privately with members. Every exposed tracker endpoint enforces it when configured. All authorized callers can read, upload and reset; character names are attribution, not authentication. URL-only mode allows anyone who obtains the URL to use those endpoints. [Environment variables](https://docs.convex.dev/production/environment-variables).
4. Copy the `https://your-deployment.convex.cloud` URL into Settings → Sharing. Save connection (or the bottom Save settings button) stores it locally immediately, then checks the deployed functions in the background. A compatible empty backend is initialized with dataset metadata without clearing data. First Sync also performs this initialization. Test connection is read-only. No separate initialization command is required.

Missing-function errors mean the owner still needs to deploy this source to that deployment. Reset cannot install missing functions; it only clears tracker data after setup. The app never carries a Convex deploy/admin key or runs an owner CLI command. No production deployment is needed.

## Player settings and sync

The URL and optional masked/reveal key can be saved from either Save connection or Save settings. Unsaved Sharing fields survive switching Settings tabs. A trailing URL slash is accepted. Dashboard URLs, `.convex.site`, paths and non-HTTPS origins are rejected.

Credentials are stored in the ignored `data/sharing-secrets.json` beside the executable. This plaintext portable file is excluded from timer exports, diagnostics and release ZIPs. Copying it also copies group access. Remove connection clears the saved URL/key and preserves local timers. Changing URL/key stops automatic sync and discards replies from the old connection. To rotate access, update MVP_GROUP_KEY on the deployment and save the new key in each app.

Click Sync or press F9 for one sync. Start immediately syncs and schedules future runs; Stop cancels future scheduled work while allowing an active response to finish. The interval choices are **10s, 20s, 30s, 1m, 2m and 5m**, with 1m the default. The chosen interval persists, but automatic mode always starts stopped after launch. You can change the interval while running or request manual Sync at any time; repeated clicks during one request coalesce into one follow-up, without overlapping calls. Capture and tray operation continue independently. Sleep/resume produces one overdue run, not a backlog.

Temporary network/quota failures use bounded backoff; key, version and validation errors pause automatic sync. The footer shows progress, next run and last successful sync. With an unchanged dataset, polling returns only small metadata. At 10 seconds, one continuously running client makes about 259,200 scheduled calls per 30 days; at 60 seconds, about 43,200, before setup/retry/cleanup overhead. Check your deployment usage when selecting an interval; payload measurements are not a promise about provider limits.

Sharing uses the live character, a clearly marked cached character, or the optional manual fallback. If none is known, uploads still work and store a null sender, displayed as Anonymous in Details. Killer, original observer and submitting character remain distinct. The server sets acceptance time and sender for newly accepted evidence; polling does not refresh evidence or attribution.

## Merge, expiry and reset

One dataset uses `trackerMeta`, indexed `bossTimers`, and up to 32 `resetReceipts`. Transactional sync merges by gathered timestamp and stable observation ID, returns a full snapshot or revision delta, and preserves other players' unselected slots. Only selected, unexpired local observations are candidates for upload. Durable acknowledgements and merged local timers are saved atomically. Local edits/capture arriving during a request remain eligible for the next sync. An unchanged response does not rewrite the timer file.

Observations expire 150 minutes after kill time; rechecking a grave does not extend that deadline. Coalesced server cleanup jobs clear expired payloads even with no clients running, retaining slot labels and revisions. Jobs validate their generation/token so an old job cannot clear a newer reset generation. [Scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions).

After a successful Sync, Settings → Sharing offers Reset shared timers. Its confirmation identifies the destination dataset and warns that all players' tracker observations will be cleared. Reset stops automatic mode and drains active sync, preserves schema and unrelated tables, advances generation and records a stable retry receipt. A lost response is retried with the same durably saved request ID through Sync, so it cannot clear later observations a second time. Kills at or before the reset cutoff are discarded locally and cannot be replayed from old imports or caches; later kills remain eligible. Reset leaves automatic mode stopped.

## Testing and logs

`bun run check` runs TypeScript, Bun desktop/core tests and Vitest/convex-test mocks without credentials. These verify behavior, not live platform concurrency or quota limits. See [Step 7 verification](step-7-verification.md) and [Convex testing](https://docs.convex.dev/testing/convex-test).

For later destructive integration tests only, prepare a separate cloud dev deployment with these functions, initialize it and set **MVP_DISPOSABLE_TEST=1**. Never set that flag on the group's deployment. Copy `.env.integration.example` to ignored `.env.integration`, fill in the separate URL/key and set `MVP_INTEGRATION_ALLOW_RESET=YES_DISPOSABLE`. Run `bun run test:convex:integration`. Both local opt-in and the server disposable flag are required before Reset. The script checks concurrent same-slot convergence and clears its fixtures; it is not part of check/build/release and has not been run against a real deployment here.

Capture & diagnostics offers Open logs and Clear logs. Clear removes only the app's known rotating log files and leaves other files intact. Logs remain bounded to five 2 MiB files and seven days. More detailed sanitized operation/timing/error diagnostics are planned for Step 8. The app excludes keys, names, function arguments and raw remote errors; server handlers emit fixed error codes without console logs. Convex's own activity/validation logs are available to trusted project operators and may contain argument details. They are outside the desktop retention policy. [Convex logs](https://docs.convex.dev/dashboard/deployments/logs).
