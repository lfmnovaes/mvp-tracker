# Step 10 — acceptance and UX tests

Owner: development agent. Status: pending execution. This replaces unfinished checks scattered across Steps 1–9. Automated coverage is recorded in [verification](verification.md); it does not establish live desktop or network behavior.

Use isolated portable data, synthetic entries and a disposable Convex deployment. Real capture needs an available game session; monitor/clean-machine checks need the corresponding environment. Record blocked prerequisites rather than assuming a pass. Keep destructive operations away from the group's production data.

| Area | Exercise | Pass criteria |
|---|---|---|
| Local workflow | Add/edit near midnight in both formats; invalid/future kills; Details; delete; selected/disabled bosses; mixed search/sort | Correct kill/gathered time, killer and map; no silent mutation or lost input |
| Layout/keyboard | Empty/full 42/594 rows, all six Settings tabs, 80–125% app scale, 125–200% Windows DPI, small window, keyboard-only dialogs | Fixed filters/actions remain reachable; focus stays stable during updates; readable colors and errors; reduced-motion works |
| Table feedback | Gathered-only update, identical sync, status transition, multiple rapid updates | Two-second highlight on change only; Spawned above Spawn window; age colors/Details agree |
| Clipboard | Text/JSON/compressed round trips, invalid/oversized input, cancel, locked clipboard | Text is concise Dark Fortress only; full formats preserve evidence; bounded failures and no partial import |
| Native shell | X, minimize, tray actions, F7/F8/F9, shortcut collision/change, second instance, start minimized, Explorer restart, Exit | Capture survives hiding; one owner of portable state; tray returns; no orphan processes |
| Placement | Move/resize on second/negative-coordinate monitor; hide/Exit/relaunch; maximize/minimize; remove/rearrange monitor | Normal bounds restored; disconnected display falls back visibly; no offscreen window |
| Capture | Approach/revisit grave, newly killed boss, channel/region/character change, game restart, unknown context | Correct slot/times/identity; fresh observations refresh; cached names labeled; no cross-channel leakage |
| Experimental coordinates | Two known graves, fresh empty spawn then SyncType, revisit, nested/missing/partial transforms, map/channel change and reused IDs; toggle off | X/Y corresponds to world X/Z and known landmarks; no player-position fallback or stale cross-map joins; missing position never blocks a grave |
| Experimental Alive | Approach known boss with positive health, observe damage/death, leave range, revisit, unknown/owned entities; toggle off | Only explicit positive health refreshes Gathered at; no fake kill; Alive → Last seen alive at 1m → Outdated at 5m; full sharing retains attribution/position and text omits sightings |
| Capture regression | Move between maps without a new channel list, approach graves during delayed process discovery, unrelated transports, reconnect | Same verified region/channel survives map notifications and initial process discovery; authentication changes invalidate it |
| Recovery | Missing/restricted Npcap, adapter change/unplug, packet stall, sleep/resume, system clock adjustment | Actionable status, bounded retry, manual functions remain usable; no fabricated spawn/observation |
| Two clients | A/B exchange newer/older and identical evidence, anonymous sender, character switch during upload, deselected remote rows | Deterministic convergence; killer/observer/submitter preserved; no-op revision stable; remote rows preserved |
| Scheduler | Start at 5s; manual Sync during request; change intervals; Stop; offline/restore; slow response | No overlap or catch-up burst; one follow-up; next interval measured after completion; bounded backoff and accurate footer |
| Shared maintenance | Expired/fresh rows together, cleanup race with fresh evidence, confirmed Reset, lost reset response/retry, stale client/import | Fresh rows survive; deletion propagates; reset retry cannot erase new data; stale evidence cannot repopulate |
| Storage/upgrade | Exit and upgrade preserving data; corrupt/truncated/read-only files in isolated copy; reopen next day | Settings/URL survive; failures visible; corrupt data preserved for recovery; expired payloads cleared |
| Diagnostics | Open logs, failed connection, sample health, Copy diagnostics, Clear logs, trigger another failure | Correct folder; event/operation/reason/category available; no private payloads; logs recover after clearing |
| Clean installation | Extract on clean Windows 11 x64; missing/present prerequisites; startup, tray and Exit | Helpful dependency errors and successful supported startup; runtime ZIP needs no source folder or developer tools |
| Performance/usage | 42 and 594 synthetic slots; observe UI under capture+5s sync; record Convex calls/I/O/egress for two clients | No sustained busy state/focus loss; measured usage/latency documented, no free-plan capacity claim from mocks |

For an issue: Copy diagnostics before changes, start **Sample health for 5 minutes**, reproduce one flow, copy again before Exit/Clear logs. Sampling is bounded to 30 records, every ten seconds. If the backend cannot respond, collect recent rotating logs beside the executable. Never paste raw packet captures or owner environment files.

Report:

```text
Version / commit:
Test row / environment (Windows, DPI, monitors):
Approximate time (America/Sao_Paulo):
Actions:
Expected:
Observed / exact message:
Reproducible:
Capture or other clients active:
Before / after diagnostics JSON:
Result: pass / fail / blocked
```

Healthy snapshots normally have writable storage, ready tray, no pending reset and progressing sync.lastAt when running. Waiting/stopped are normal. Unchanged polling leaves revision stable and intentionally emits no success log. Logs support diagnosis; visual/game correctness still requires observation.
