# Project overview

MVP Tracker is a portable Windows 11 x64 application focused on Spirit Vale boss timers. It collects all 33 supported bosses across six server regions and channels 1–3, including records hidden by display preferences. The default view selects the seven Dark Fortress bosses in SA and NA. Robot Dragon and living-boss detection are excluded.

## Behavior

- Tracking settings control the table, filters, manual entry and clipboard selections. Location filters sort by map minimum level, highest first.
- Kill evidence gives a 60–90 minute spawn window and expires after 150 minutes. Silence or an object despawn is not evidence of a new kill. Newer gathered evidence wins during merge.
- Manual edits set the kill time and gather time at confirmation. Names are optional. UTC timestamps are displayed in America/Sao_Paulo; 24-hour time is the default.
- Gathered-time changes and new rows highlight for four seconds. Ten freshness colors use a configurable interval, default three minutes.
- Experimental coordinates display world X/Z as X/Y; missing positions show **Not located**. They are not calibrated map-grid coordinates.
- Full JSON/compressed exports preserve evidence and attribution. Concise text exports contain only selected Dark Fortress kill times. Imports merge newer evidence.
- X hides to tray; minimize uses the taskbar. Bounds, screen and size are restored. F7 toggles the window, F8 adds a timer, F9 syncs.

## Storage and architecture

Preact → validated IPC → Bun backend. Neutralino hosts the window; a C# helper handles tray, hotkeys and window placement. Local `src/spiritvale/` code owns Windows/Npcap capture, attribution, decoding and character identity. A separate worker optimizes recordings without blocking capture.

Portable state lives beside the executable: `data/settings.json`, `sharing.json`, `timers.json` and `window.json`. Atomic saves protect updates; read-only storage errors are reported. Logs live in `logs/`. See [diagnostics](diagnostics.md).

Observations retain boss/region/channel, unique evidence ID, kill and gather timestamps, provenance, precision, optional position, killer, observer and instance/edit references. Accepted submissions retain forwarding character and server receipt time. Expired evidence is discarded; empty outdated slot labels can be removed with **Delete outdated**.

Convex tables:

| Table | Purpose |
|---|---|
| bossTimers | Canonical slots, current observation, change revision and indexed expiry |
| trackerMeta | Dataset/reset generation, change cursor, deletion cursor and scheduled-expiry state |
| resetReceipts | Last 32 reset results; retries cannot erase newer observations |

Identical syncs do not advance revisions. Actual evidence changes, expiry, resets and deletions do. `expiresAt` is kill time +150 minutes and drives scheduled cleanup; it is absent after evidence expires. Full snapshots recover after deletions/reset; normal polls use deltas. Storage schema 2 reads schema 1; sharing protocol 4 requires matching clients.

## Convex setup

Sharing is optional. Ordinary users only enter an HTTPS `*.convex.cloud` URL in Settings → Sharing, save, then test the connection. No environment file, group key or character name is required by the app. Anyone with this URL can read, write and reset tracker data.

The database owner deploys once from source:

```powershell
npx convex dev --configure --dev-deployment cloud --once
```

Choose the intended cloud development deployment. Keep the CLI-generated `.env.local`: `CONVEX_DEPLOYMENT` selects it, and `CONVEX_URL` provides the URL to copy. `CONVEX_SITE_URL` is unused. [The empty sample](../.env.local.sample) is a reference, not a replacement for an existing configuration.

After backend changes, the owner runs `npx convex dev --once`. Ordinary app launches require neither command. Upgrades from before 0.1.9.2 require deployment and matching clients; 0.1.9.6 needs no further deployment after that upgrade.

**Reset database** confirms before clearing shared tracker data; schema/function deployment still requires the CLI. Automatic sync starts stopped each launch, with intervals of 5/10/20/30 seconds or 1/2 minutes. Manual sync and interval changes remain available; overlapping requests coalesce and failures back off.

## Third-party attribution

Copyright (C) 2026 Luis Fernando. App and modified capture source are AGPL-3.0-only; see [LICENSE.txt](../LICENSE.txt). Matching source is supplied separately with every release. Full redistributed dependency notices remain in `licenses/` in the portable ZIP.

- Capture/decoder source and historical fixtures: kar-mi and contributors, [spirit-vale-tools](https://github.com/kar-mi/spirit-vale-tools/tree/6e075bea7e81270b5fca81a49e1e2f5bc6fde10b/packages/capture), revision `6e075bea7e81270b5fca81a49e1e2f5bc6fde10b` (AGPL-3.0-only). Maintained locally; no kar-mi npm dependency remains.
- Boss catalog: spirit-vale-tools revision `87db1d724d5738ec8b5f3cb258e357e757813264` (AGPL-3.0-only); unrelated reward data omitted.
- Extension transport and capture admission/channel behavior: [spirit-vale-overlay](https://github.com/kar-mi/spirit-vale-overlay/tree/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389), revision `4f1f8000bbdb19f7234aa9e73ddb89106fe3d389` (AGPL-3.0-only), adapted for tracker-only use and bounded IPC.
- Location labels and map levels: [SpiritValers](https://spiritvalers.com/), verified September 27 / October 7, 2026. Game names/data belong to the game developers; no game/wiki artwork is bundled.
- Neutralino and Preact: MIT. Bun: MIT with its bundled third-party notices. Convex client: Apache-2.0. Exact runtime/build/test versions are pinned in `package.json` and `bun.lock`; test packages are not shipped in the runtime.

Npcap, Windows WebView2 and .NET Framework are prerequisites, not redistributed. No game binaries or recordings are included in source or release archives.
