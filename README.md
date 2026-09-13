# MVP Tracker

Portable, unsigned Windows 11 x64 boss tracker for Spirit Vale. Version **0.1.9.2**. Local tracking works without Convex.

## First run

1. Extract the full portable ZIP into a writable folder and open **MVP Tracker.exe**. Windows WebView2 and .NET Framework 4.x are required.
2. For automatic capture, install [Npcap](https://npcap.com/#download) with **WinPcap API-compatible mode**, start the game and walk near a gravestone. Manual entries work without Npcap.
3. For shared timers, enter your group's **Convex URL** in Settings → Sharing → **Save settings**, then **Test connection**. No key, character name or `.env` file is required by the app. The owner must deploy the backend first; see below.

## Subsequent runs

Open **MVP Tracker.exe** again; settings, window position/monitor/size and current timers are restored. If the saved monitor is disconnected, the window returns to the primary screen. X hides to tray; use tray → Exit to quit. F7 shows/hides, F8 adds a timer, F9 syncs. Start enables automatic sync; it starts stopped each launch. Reset database asks for confirmation and clears everyone's tracker observations.

For upgrades, Exit first, replace the application files, and keep your `data/` folder. Kill observations expire after 150 minutes. [Sharing details](docs/convex-setup.md).

**Delete outdated** in the footer removes expired local and database rows while preserving current observations. It works locally without a URL; a database failure is reported separately. Deploy the latest backend once to enable shared cleanup.

Experimental X/Y shows ground world X/Z, not a calibrated game-map grid; missing coordinates show **Not located**. Coordinate capture can be disabled in Settings → Capture.

Status sorting puts Spawned before Spawn window and Waiting. Rows highlight for three seconds only when Gathered at changes. Settings → Colors controls the interval between ten fixed freshness colors; default three minutes. Outdated uses muted red and discards its old timestamp.

## Run from source

Install Bun **1.4.2** and Node.js. First time, from this repository:

```powershell
bun install --frozen-lockfile
bun run setup
bun run dev
```

Later: `bun run dev`. After dependency changes: `bun install --frozen-lockfile` first. Exit before rebuilding. `bun run check` checks both TypeScript projects and unit tests; `bun run package` creates separate runtime/source ZIPs in `release/`.

## Convex owner only

First setup (choose your existing project and cloud development deployment):

```powershell
npx convex dev --configure --dev-deployment cloud --once
```

After backend updates—or to retry a failed type-check—run **`npx convex dev --once`**. Ordinary app launches need neither command. Deploy the matching backend before running this URL-only build (sharing protocol 4). For 0.1.9.2, redeploy once and upgrade every sharing client; no Reset is required. Retired experimental sightings are cleared automatically; valid kill timers are preserved. Local data and full exports migrate to schema 2 (schema 1 imports still work); keep a data backup before downgrading.

Keep the CLI-generated `.env.local`: `CONVEX_DEPLOYMENT` selects the owner's deployment; `CONVEX_URL` is a convenient copy of its URL. The app reads its URL from Settings. `CONVEX_SITE_URL` is unused by this project. [`.env.local.sample`](.env.local.sample) is an optional empty reference; never copy it over an existing configuration. [Convex configuration](https://docs.convex.dev/production/project-configuration).

Reset clears tracker data and restores metadata for the deployed backend; schema/function updates require the owner's CLI command. Anyone with the deployment URL can use the tracker endpoints. There is no group-key or integration-environment setup.

For errors, use Settings → Diagnostics → Copy diagnostics. [Acceptance tests and report template](docs/testing.md) · [Troubleshooting](docs/troubleshooting.md) · [Release builds and checksums](docs/releases.md).

Licensed under **AGPL-3.0-only**; see [notices](THIRD_PARTY_NOTICES.md). [Plan](docs/plan.md) · [Verification](docs/verification.md) · [Data model](docs/data-model.md) · [Future improvements](docs/improvements.md).
