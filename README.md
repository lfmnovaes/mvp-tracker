# MVP Tracker

Portable, unsigned Windows 11 x64 boss tracker for Spirit Vale. Version **0.1.8.2**. Local tracking works without Convex.

## First run

1. Extract the full portable ZIP into a writable folder and open **MVP Tracker.exe**. Windows WebView2 and .NET Framework 4.x are required.
2. For automatic capture, install [Npcap](https://npcap.com/#download) with **WinPcap API-compatible mode**, start the game and walk near a gravestone. Manual entries work without Npcap.
3. For shared timers, enter your group's **Convex URL** in Settings → Sharing → **Save settings**, then **Test connection**. No key, character name or `.env` file is required by the app. The owner must deploy the backend first; see below.

## Subsequent runs

Open **MVP Tracker.exe** again; settings, window position/monitor/size and current timers are restored. If the saved monitor is disconnected, the window returns to the primary screen. X hides to tray; use tray → Exit to quit. F7 shows/hides, F8 adds a timer, F9 syncs. Start enables automatic sync; it starts stopped each launch. Reset database asks for confirmation and clears everyone's tracker observations.

For upgrades, Exit first, replace the application files, and keep your `data/` folder. Expired observations are discarded after 150 minutes. [Sharing details](docs/convex-setup.md).

**Delete outdated** in the footer removes expired local and database rows while preserving current observations. It works locally without a URL; a database failure is reported separately. Deploy the latest backend once to enable shared cleanup.

Status sorting puts Spawned before Spawn window and Waiting. Updated rows briefly highlight; Gathered at runs from green to red in ten 15-minute freshness bands. Outdated uses muted red and discards its old timestamp.

## Run from source

Install Bun **1.4.2** and Node.js. First time, from this repository:

```powershell
bun install --frozen-lockfile
bun run setup
bun run dev
```

Later: `bun run dev`. After pulling dependency changes: run `bun install --frozen-lockfile` first. Exit any running copy before rebuilding. `bun run check` checks both TypeScript projects and runs unit tests; `bun run package` creates the portable ZIP in `release/`.

## Convex owner only

First setup (choose your existing project and cloud development deployment):

```powershell
npx convex dev --configure --dev-deployment cloud --once
```

After backend updates—or to retry a failed type-check—run **`npx convex dev --once`**. Ordinary app launches need neither command. Deploy the matching backend before running this URL-only build (sharing protocol 2).

Keep the CLI-generated `.env.local`: `CONVEX_DEPLOYMENT` selects the owner's deployment; `CONVEX_URL` is a convenient copy of its URL. The app reads its URL from Settings. `CONVEX_SITE_URL` is unused by this project. [`.env.local.sample`](.env.local.sample) is an optional empty reference; never copy it over an existing configuration. [Convex configuration](https://docs.convex.dev/production/project-configuration).

Reset clears tracker data and restores metadata for the deployed backend; schema/function updates require the owner's CLI command. Anyone with the deployment URL can use the tracker endpoints. There is no group-key or integration-environment setup.

For errors, use Settings → Capture & diagnostics → Copy diagnostics. [Test and paste-back checklist](docs/test-report.md) · [Troubleshooting](docs/troubleshooting.md). [Release builds and checksums](docs/releases.md).

Licensed under **AGPL-3.0-only**; see [notices](THIRD_PARTY_NOTICES.md). [Implementation plan](plan.md) · [latest verification](docs/step-9-verification.md).
