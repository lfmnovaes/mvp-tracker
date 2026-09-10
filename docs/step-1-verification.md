# Step 1 verification — 2026-09-10

Implementation: Neutralino 6.9.0 + Preact + Bun, Windows 11 x64. Source and local portable artifact version: 0.1.0. No capture, catalog or remote operations are represented as working in this shell build.

## Automated checks

- TypeScript strict check.
- Portable preferences survive restart; writes replace atomically and leave no temporary files.
- Corrupt/future settings preserve original bytes until a valid save.
- An unusable data directory reports read-only status and does not use a fallback directory.
- Shortcut input rejects duplicates, bare letters, unsupported syntax and Windows-reserved F12.
- RPC rejects unknown methods, malformed IDs and invalid/oversized clipboard inputs.
- Logs rotate within their byte/file limits and remove aged files. Entries contain only timestamps and fixed event names.
- Real local WebSocket transport test covers native success/error envelopes and disconnect rejection.

Commands: `bun run check`, `bun run package`. The build compiles the x64 Windows companion and bundles both entry points. Packaging contains Windows binaries only, excludes data/logs, and includes notices and corresponding source.

## Desktop checks performed

The app was exercised through Windows Computer Use, with separate read-only process checks:

- Development window rendered the dark tracker table scaffold and Settings.
- General settings saved `startMinimized: true` to portable JSON; successful save was visible.
- Settings → Exit terminated the native window, Bun backend and C# companion; no tracker process remained.
- Starting with the saved tray option produced no visible tracker window, while all three processes continued running.
- A second launch restored the existing instance; only the original process family remained.
- Titlebar close and F7 hide retained the backend. F7 was verified to remove the visible tracker from the window list.
- F8 and F9 reached their respective honest availability messages.
- The restored view showed the intended one-minute default and all six planned intervals in source.

A test-launcher problem was found: forcing the interactive Neutralino GUI to start with Windows' hidden startup flag can leave it unpainted. The development launcher now uses a normal GUI launch. Helpers continue to start hidden. Restore checks passed with normal Explorer-style launch.

The Windows host filters out untitled WebView2 helper windows and avoids moving Neutralino's temporary offscreen initialization window. Neutralino APIs own hide/show/minimize state. Shortcut registration pauses during input recording and resumes on blur, with a bounded timeout for abandoned capture.

## Outstanding native verification

The user stopped Computer Use with the physical Escape key during the remaining tests. No further desktop input was issued. **The final Step 1 native verification gate is still pending**, even though the implementation and local packaging are present.

- Extract the final ZIP into a fresh writable folder (including a path with spaces) and launch `MVP Tracker.exe`; repeat hide, restore, Settings, and Exit.
- Verify minimize goes to the taskbar, Alt+F4 hides to tray, and F7 restores while a different app is focused.
- Exercise the real tray context menu and double-click; verify Show, Settings and Exit.
- Record/rebind/disable shortcuts; deliberately occupy one shortcut in a separate test program and confirm conflict feedback. Hold a shortcut and confirm no repeat actions. Verify behavior with the actual game focused later.
- Test the native companion failure fallback and backend/window crash cleanup after the final lifecycle changes.
- Exercise Explorer restart, sleep/resume and monitor removal on a suitable test desktop. These must not be performed disruptively on the user's active session without arranging the test.

Do not label these unperformed checks as passed. Live game capture and Convex tests remain in their own later steps.
