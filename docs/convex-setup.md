# Convex group setup — version 0.1.6

Step 6 provides database functions and desktop Save/Test connection. The Sync/Start buttons and confirmed Reset UI become active in Step 7. Testing a connection never initializes, resets or uploads timers. The desktop needs no Node, npm, Convex account or deploy key.

## Owner: prepare one cloud development deployment

1. Create/sign in to your account at [Convex](https://www.convex.dev/). Use a Free project and a **cloud development** deployment for this small private group. Do not enable billing or select production. A local deployment on your PC is not the shared cloud database.
2. In the source repository, install the locked dependencies with `bun install --frozen-lockfile`. Node 22.12+ or Node 24 is required by the test tools; this build was checked with Node 24.21.0 and Bun 1.4.2.
3. Run `npx convex dev --configure --dev-deployment cloud --once`. Complete the interactive login/project selection and confirm that it targets your intended cloud dev deployment. The pinned local Convex CLI is 1.45.0. Later backend updates use `npx convex dev --once` with that saved selection. Deployment updates preserve existing timer data; they are not Reset commands. See [Convex dev options](https://docs.convex.dev/cli/reference/dev).
4. Generate a random group key with a password manager: 32–128 characters from letters, digits, `_` and `-`. A random 64-character hexadecimal key is suitable. In the selected deployment's Dashboard → Settings → Environment Variables, set **MVP_GROUP_KEY** to that key. Do not put it in Git, shell history, messages, or timer exports. All members with the key can read, upload and reset this dataset. Character names are attribution, not authentication. [Environment variables](https://docs.convex.dev/production/environment-variables).
5. Run `npx convex run timers:initialize`. This owner-only internal mutation initializes metadata if absent; running it again preserves the same dataset and observations. Catalog definitions/version ship with the backend and app. No destructive owner command runs during build, startup, Test or ordinary deployment.
6. Copy the deployment URL, in the form `https://your-deployment.convex.cloud`, from the dashboard. Send that URL and the group key to your private group through your chosen private channel. Dashboard URLs and `.convex.site` HTTP-action URLs are not supported.

The CLI creates `.env.local` containing deployment selection. That file, `.env*`, `.convex/`, and local secrets are ignored by Git. Commit the normal `convex/_generated` files after owner deployment regenerates them. `bun run convex:types` bootstraps types locally from the pinned CLI templates and the TypeScript schema without cloud access; normal owner deployment remains the supported way to refresh deployed function types. It does not provision a database.

## Player: connect

Open Settings → Sharing, enter the URL and group key, then **Save connection** and **Test connection**. The key is masked with an optional reveal checkbox. Connection settings have their own Save button; the bottom Save settings button handles General/Tracking/Capture preferences.

The connection starts empty. A saved connection is untested after restart. Test checks authorization, application/protocol/schema/catalog versions, initialization and server clock. It distinguishes rejected keys, missing functions, missing initialization, version mismatch, network/service/quota trouble and a Windows clock more than 30 seconds from the server. Version mismatch calls for matching backend code, never an automatic Reset.

URL/key live together in `data/sharing-secrets.json` beside the executable, separately from ordinary settings and timer data. This portable file is plaintext: copying it grants group access. It is not included in timer exports, diagnostic copies or release ZIPs. Remove connection clears its saved credentials and preserves local timers. To rotate access, the owner changes MVP_GROUP_KEY in Convex and distributes the new key. Each player saves the new key and tests again.

Only HTTPS `.convex.cloud` origins are accepted. The backend disables redirects and SDK logging, bounds requests to eight seconds and discards replies from canceled/changed connections. Network tests do not block local capture, edits or Exit. No background subscription or polling starts in Step 6.

## Data contract for Step 7

One dataset uses `trackerMeta`, indexed `bossTimers`, and at most 32 `resetReceipts`. `timers.sync` authorizes and validates in one transaction, compares gathered timestamps with a stable ID tie-break, and returns a full snapshot or revision delta. Omitted slots are preserved. No-change polls with no candidates read metadata and return no slot rows. Keys are deterministic boss/region/channel tuples, not display names or row numbers.

Uploads require a nonempty sender name. The server assigns `submission.submittedByCharacter` and `submission.serverAcceptedAt` only when accepting a new winning observation, replacing any caller-supplied attribution. Repeated evidence does not advance revision, gathered time or attribution. Killer, original observer and submitting character remain distinct. Submission metadata is included in Details and JSON/compressed exchange; clipboard metadata remains unauthenticated provenance and does not decide freshness.

An authorized snapshot query supports pull-only users without a character name. Sync clears due expired payloads and emits cleared-slot deltas. Snapshots hide expired values without writes. Automatic server cleanup while nobody syncs is Step 7 work; until then expired stored payloads are removed by the next sync or Reset.

Reset requires the expected dataset/generation and a stable request ID. It clears all slot rows, preserves schema/metadata, increments generation and records a bounded retry receipt. Old-generation requests reject. A retry of the same Reset returns its receipt without deleting later data. Once a receipt ages out of the 32-entry bound, its old generation still prevents another reset. A kill at or before the reset cutoff cannot repopulate the dataset through replay or a later grave recheck; only subsequent kills upload. Local timers are independent of this shared reset. The confirmed desktop workflow and durable sync acknowledgements arrive in Step 7.

## Testing and logs

`bun run check` runs TypeScript, Bun desktop/core tests and Vitest/convex-test mocks. No credentials or real service are needed. These verify function behavior, not real backend concurrency or plan limits. [Convex testing](https://docs.convex.dev/testing/convex-test).

For later **destructive integration tests only**, prepare a separate cloud dev deployment/project with the same functions, initialize it, and set its environment variable **MVP_DISPOSABLE_TEST=1**. Never set that flag on the group's deployment. Copy `.env.integration.example` to ignored `.env.integration`, fill in its separate URL/key and set `MVP_INTEGRATION_ALLOW_RESET=YES_DISPOSABLE`. Run `bun run test:convex:integration`. The script requires both local opt-in and the server-side disposable flag before any Reset; it checks concurrent same-slot convergence and clears its fixtures. It does not run as part of `check`, build or release, and has not been executed against a real deployment here.

The app does not log keys, function arguments, names or remote error text. Server handlers emit only fixed application error codes and no console logs. Convex itself records function activity and failures; its dashboard/function runner is available to trusted project operators. Platform validation exceptions may contain argument details, and operators can access deployment secrets, so treat dashboard/deploy-key access as trusted administrative access. The platform's own logs are not covered by the app's local log retention policy. See [Convex logs](https://docs.convex.dev/dashboard/deployments/logs) and [debugging behavior](https://docs.convex.dev/functions/debugging).
