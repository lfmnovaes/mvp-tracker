# MVP Tracker

Portable Windows 11 x64 boss tracker for Spirit Vale. **Version 0.1.1 completes the desktop shell only.** Capture, boss timers and data exchange are subsequent steps in plan.md; this build does not collect game data.

Extract the entire portable ZIP into a writable folder and open **MVP Tracker.exe**. Windows 11's WebView2 runtime and .NET Framework 4.x are required. No Node/Bun/npm installation is required to run the ZIP. This build is unsigned.

- Close / Alt+F4 hides to the system tray. Minimize uses the taskbar.
- Tray: double-click to show; right-click for Show MVP Tracker, Settings and Exit.
- F7 toggles visibility; F8 and F9 currently show the manual-entry/sync availability message. Configure or disable shortcuts in General. Registered shortcuts consume the keystroke; conflicts appear after saving. F12 is reserved by Windows.
- Start hidden in tray is optional and off by default. Only one instance per Windows user/session runs, including across portable copies.
- Preferences are stored atomically in data/settings.json beside the executable. A read-only folder produces a visible warning. No AppData fallback.
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

Verification records are in docs/step-1-verification.md. Licensed under GNU AGPL v3 only; see LICENSE.txt and THIRD_PARTY_NOTICES.md.

The window centers on first launch and restores its last position and size on subsequent launches (Neutralino's portable .tmp/window_state.config.json). Development uses directory resources, so it does not need a root resources.neu. Manual testing is primarily performed by the user later in development; early gates use focused unit tests and builds.
