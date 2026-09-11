# MVP Tracker

Portable Windows 11 x64 boss tracker for Spirit Vale. **Version 0.1.5 adds clipboard export/import, slimmer timer rows and a single window status bar for timezone and character context.** Convex sharing remains the next implementation step.

Choose Text, JSON or Compressed and click Export to copy selected current observations. Search filters do not limit exports. Text contains only selected Dark Fortress kill times in 24-hour format, grouped by region/channel with UTC-3 headers. JSON and `MVPT1:` compressed strings preserve kill/gathered times, killer and observer. Empty exports leave the clipboard unchanged. Compression is not encryption.

Import opens an empty input: paste JSON or a compressed string, preview the counts, then confirm Merge timers. Compact text cannot be imported. Confirmation checks the latest local evidence and selections again; disabled/expired entries are skipped and repeated imports never refresh gathered time. Invalid batches cause no import mutation. Input/expanded JSON is limited to 500 KB and 594 observations. No clipboard content is read automatically or uploaded.

Extract the entire portable ZIP into a writable folder and open **MVP Tracker.exe**. Windows 11's WebView2 runtime and .NET Framework 4.x are required. No Node/Bun/npm installation is required to run the ZIP. This build is unsigned.

- Close / Alt+F4 hides to the system tray. Minimize uses the taskbar.
- Tray: double-click to show; right-click for Show MVP Tracker, Settings and Exit.
- F7 toggles visibility; F8 opens Add manually. F9 currently shows the sync availability message. Configure or disable shortcuts in General. Registered shortcuts consume the keystroke; conflicts appear after saving. F12 is reserved by Windows.
- Start hidden in tray is optional and off by default. Only one instance per Windows user/session runs, including across portable copies.
- Preferences are stored atomically in data/settings.json beside the executable. A read-only folder produces a visible warning. No AppData fallback.
- Tracking Settings selects 33 supported bosses and six regions, with seven Dark Fortress Masters and SA/NA selected by default. Timer data lives in data/timers.json; expired observations are discarded after 150 minutes, keeping an Outdated slot. Existing observations survive deselection until expiry.
- Add manually works without live capture. Choose a selected boss, region and channel, then enter kill date/time and an optional killer. Bosses sort by level descending, then name. Today/Yesterday buttons use America/Sao_Paulo. Explicit AM/PM is the default; choose a 24-hour clock in General. Seconds are optional. Preview shows the interpreted kill and spawn window before Save.
- Edit fixes the boss/region/channel and changes only the kill date/time and optional killer. Save stamps gathered time from the current Windows clock; the caller cannot supply it. Future or invalid times are rejected. Saving an expired kill clears the slot to Outdated. Capture and later manual evidence may replace one another by freshness. Storage warnings mean changes may only be held in memory.
- Table headers sort; search combines tokens such as `paladin sa ch2`, `region:na` or `dark fortress`. Region/channel dropdowns further filter the table. Details shows the kill time, gathered time, source, observer and guaranteed spawn time. Row ordering waits while row actions have keyboard focus. Draft text stays unchanged during capture updates.
- General offers 80%, 90%, 100%, 110% and 125% interface sizes; Save applies the choice. Capture & diagnostics provides Open logs, Copy diagnostics and an optional five-minute health sample. Diagnostic reports include versions, bounded health counts and up to 100 sanitized event codes, excluding names, paths, adapter labels, settings and raw packets. Sampling stays in memory and never uploads anything.
- Capture requires a separate [Npcap installation](https://npcap.com/#download) with **WinPcap API-compatible mode** enabled. Npcap is not bundled. The app follows SpiritVale.exe and passively reads its UDP traffic; it does not inject or modify game traffic.
- Walk near a gravestone to collect a timer. Capture continues in the tray. Settings → Capture & diagnostics shows game/adapter health, latest decoded packet time and Retry capture. Automatic adapter selection is the default; choose another adapter and save if needed. Capture retries failures and recovers after sleep. If context is unknown, change maps/channels and revisit the grave; the app does not guess a region or channel.
- The local character is detected from the game's outbound object and identity updates. A last-seen name is marked cached for this session; it is not treated as live. An optional manual character name prepares the fallback for future sharing. A grave's killer and original observer remain separate. Unknown, malformed and contradictory grave data is skipped.
- Logs beside the executable contain only allowlisted lifecycle/error events, at most five 2 MiB files, retained for seven days. No game packets, keys, clipboard contents, character names or paths are logged.
- If the native companion fails, the window is restored and offers Exit. If the backend or owning window dies, the companion stops its process family. Restart restores normal operation.

## Build from source

On Windows 11 x64, install **Bun 1.4.2** and Node.js (used by the Neutralino build CLI), then run from this folder:

```powershell
bun install --frozen-lockfile
bun run setup
bun run check
bun run dev
```

`setup` downloads the pinned Neutralino 6.9.0 runtime. The C# companion is compiled with the Windows .NET Framework compiler; no separate .NET SDK is required. The clock icon is generated from drawing primitives during the build.

Close the app through Settings → Exit before rebuilding (Windows locks running executables).

```powershell
bun run package
```

The Windows-only ZIP is in release/. It includes the Bun runtime, companion, Neutralino resources, license notices and corresponding source. It excludes local data and logs. This is a local packaging command; automated GitHub release workflows are planned for Step 9.

Verification records are in docs/step-1-verification.md through docs/step-4-verification.md. Live packet cadence, revisits, region switching, Npcap compatibility and manual desktop checks remain pending user testing. Licensed under GNU AGPL v3 only; see LICENSE.txt and THIRD_PARTY_NOTICES.md.

The window centers on first launch and restores its last position and size on subsequent launches (Neutralino's portable .tmp/window_state.config.json). Development uses directory resources, so it does not need a root resources.neu. Manual testing is primarily performed by the user later in development; early gates use focused unit tests and builds.
