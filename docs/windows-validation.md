# Windows / private-group check

Use 0.1.8.2. These are the remaining user checks for Step 8; the automated tests already cover the underlying timer/merge/scheduler rules. Use the [test and paste-back template](test-report.md) to record pass/fail and copied diagnostics.

1. **Upgrade and local work:** Exit through the tray, keep `data/`, replace app files, reopen. Confirm URL/settings survive. Move/resize on a second monitor, hide/Exit/relaunch and confirm bounds; disconnect that monitor and confirm a visible fallback. Add/edit a timer, export/import it, restart, and check its kill/gathered times and killer. A gathered-only update should highlight the row for two seconds; an unchanged sync should not. Check Spawned-first sorting and freshness colors, including at your usual DPI.
2. **Capture and tray:** With Npcap installed, enter the game, revisit a grave, then switch channel/region. Verify boss, location, channel and observed character. X should hide while capture continues; F7/F8/F9 and tray Show/Settings/Exit should work. Test a game restart and sleep/resume.
3. **Two players:** Use the same updated backend URL. Verify newer observations win, original killer/observer stay correct, anonymous upload works, and unchanged sync does not advance revision. Start auto-sync, manually Sync, change interval and Stop. Temporarily disconnect networking and check recovery/status.
4. **Cleanup and Reset:** Test Delete outdated while a current row exists; only outdated rows should disappear on both clients. Test confirmed Reset only on a temporary/empty group deployment or when everyone agrees to clear the group; retry must not erase newer data. No Reset is needed to upgrade to 0.1.8.1.
5. **Logs:** Open logs should launch the app's log folder. Trigger a failed connection Test, then Copy diagnostics: expect operation/category/duration and versions, without URL, names or payloads. Clear logs and perform another action to confirm new logs work.
6. **Clean Windows install:** Launch the portable ZIP on another Windows 11 x64 machine with WebView2/.NET and Npcap for capture. Confirm startup, tray Exit and no orphan process. The unsigned build may show a Windows reputation prompt.

Report the failed step, app version, approximate time and copied diagnostics. Do not send raw packets, owner `.env.local`, or character/timer exports for an ordinary diagnostic report.
