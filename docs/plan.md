# MVP Tracker plan

Version 0.1.9. Windows 11 x64, portable and unsigned. Steps 0–9 are implemented; interactive acceptance is consolidated in Step 10.

## Scope

- One dark tracker window, capture/game/shell status, fixed filters and actions, tray menu, and remembered monitor/normal bounds. X hides; minimize uses the taskbar. F7 toggles, F8 adds, F9 syncs.
- Track 33 supported bosses; exclude Robot Dragon. Default: seven Dark Fortress Echo masters (Berserker, Paladin, Wizard, Priest, Gunslinger, Necromancer, Shinobi), SA and NA, channels 1–3. Weaver and other bosses/servers are selectable. Known maps are filled; unknown maps stay empty.
- Sort/search by boss, level, map, region, channel, status and gathered time. Spawned sorts before Spawn window. Rows highlight for two seconds on change; gathered age has ten color bands and an Outdated override.
- Add/edit kill date and time; stamp gathered time on confirmation. Highest-level selected bosses first, alphabetical ties. Killer is visible and exportable. Default 24-hour display; optional AM/PM. Store UTC, display America/Sao_Paulo; timezone selector stays disabled.
- A grave confirms no respawn at observation time. Spawn window: kill +60–90 minutes. Spawned: +90 minutes. Outdated: +150 minutes, discard evidence and retain the slot label until cleanup. Silence/despawn alone is not proof.
- Newer gathered evidence wins regardless of manual/capture source. Imports and sync preserve evidence timestamps; polling never refreshes them. Validate identities, clock skew and bounded payloads.
- Text export includes selected Dark Fortress kill times only, ordered by full time, with region/UTC-3 headers and b/g/n/pa/pr/s/w codes. JSON and MVPT1 gzip exports retain selected evidence/attribution; import validates, previews and merges.
- URL-only Convex sharing, optional character attribution, transactional deltas, manual sync and 5s/10s/20s/30s/1m/2m automatic intervals. Default 1m, stopped on launch. One queue, at most one follow-up, live interval changes and bounded error backoff.
- Reset confirms shared clearing; durable receipts prevent duplicate resets. Delete outdated rechecks expiry locally/remotely and preserves current rows. Settings sections: General, Hotkeys, Tracking, Sharing, Capture, Diagnostics.
- Essential bounded logs, no raw packets/names/URLs. Local state stays beside the executable. No Google integration, accounts, overlay editor, combat/reward screens or automatic Windows startup.

## Delivered steps

| Step | Delivery |
|---|---|
| 0 | Repository, dependency/license provenance and specification |
| 1 | Portable shell, tray, hotkeys, persistence and IPC |
| 2 | Catalog, timer/merge rules, selection and recovery |
| 3 | Passive capture, connection context, identity and health |
| 4 | Tracker, Add/Edit/Details, filters and Settings |
| 5 | Clipboard formats, import validation and fixed layout |
| 6 | Convex schema/functions, URL-only setup and attribution |
| 7 | Serialized sync, expiry, Reset and outdated cleanup |
| 8 | Diagnostics, regression coverage, placement and timer presentation |
| 9 | Windows CI, verified archives/checksums and draft releases |
| 0.1.9 follow-up | Lean runtime/source archives, documentation consolidation, settings sections, 5s interval and contextual logs |

## Step 10 — agent-led acceptance and UX testing

All unfinished desktop, game, multiplayer and clean-machine checks from Steps 1–9 belong here. Execute the [test matrix](testing.md), explore related failure paths, fix confirmed defects and add focused regressions where they protect behavior.

- [ ] Local workflows, focus/keyboard navigation, filters, table layout, all Settings sections and clipboard failures.
- [ ] Tray/single-instance/shortcuts, Explorer restart, screen/DPI placement, sleep and process shutdown.
- [ ] Real grave/revisit capture, fresh-kill packets, character/region/channel changes, Npcap/adapter failures and recovery.
- [ ] Two clients, anonymous attribution, concurrent sync/reset/cleanup, dropped responses, offline recovery and 5s polling usage.
- [ ] Open/Clear logs, diagnostic context/redaction, read-only/corrupt storage, portable upgrades.
- [ ] Clean Windows 11 x64 startup/Exit, prerequisites and final release review.

Record environment, actions, evidence and result for each check. Tests requiring unavailable hardware/game sessions or a disposable deployment remain explicitly blocked until available. Never use the live group's Reset for testing. Publish a validated release only after acceptance; draft builds may precede it.

## Later work

Prioritize coordinates and positive live-boss evidence after capture validation; see [improvements](improvements.md). Later: shared access controls, additional timezones, localization, optional alerts, signing and other platforms. Google/OAuth remains abandoned unless requirements change.

After each completed implementation step: run relevant checks, update concise verification, commit with a short progress message and push. Keep existing user data and published artifacts intact.
