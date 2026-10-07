# MVP Tracker

Portable Windows 11 x64 boss timers for Spirit Vale. Automatic gravestone capture, manual entries and optional shared timers through Convex. Releases are unsigned.

## Run

Download the [latest release](https://github.com/lfmnovaes/mvp-tracker/releases/latest), extract the entire Windows ZIP into a writable folder and open **MVP Tracker.exe**. Install [Npcap](https://npcap.com/#download) with **WinPcap API-compatible mode** for capture; WebView2 and .NET Framework 4.x are required.

Later runs restore settings and current timers. X hides to tray; tray → Exit quits. To upgrade, exit, replace the application files and keep the `data/` folder.

## Develop and build

Install Bun **1.4.2** and Node.js **24 LTS**. First run:

```powershell
bun install --frozen-lockfile
bun run setup
bun run dev
```

Subsequent runs: `bun run dev`. Exit before rebuilding. Repeat install after dependency changes and setup after Neutralino updates.

- `bun run check`: TypeScript and unit tests.
- `bun run package`: separate portable and source ZIPs in `release/`.
- [Project overview](docs/overview.md): settings, data, Convex setup and attribution.
- [Release procedure](docs/releases.md) · [Changelog](docs/CHANGELOG.md).

## Report a problem

Use Settings → Diagnostics → **Copy diagnostics**. For missing gravestones, record the encounter, stop, then **Optimize all recordings** before attaching the resulting `_clean.zip` to a [GitHub issue](https://github.com/lfmnovaes/mvp-tracker/issues). Include what happened and the app version. Review files before uploading: player/network details can remain. Nothing uploads automatically. [Diagnostic guide](docs/diagnostics.md).

Licensed under [AGPL-3.0-only](LICENSE.txt).
