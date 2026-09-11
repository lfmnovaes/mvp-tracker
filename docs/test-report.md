# Test and paste-back checklist

Use **0.1.8.2**. Plan for about 10 minutes plus ordinary play. Tests already cover timer math, merge/reset rules, sync scheduling, redaction, native placement geometry and packaging. Actual desktop appearance, packet traffic and independent clients still need your observations; logs alone cannot prove these.

## Capture a useful report

1. Settings → Capture & diagnostics → **Copy diagnostics**. Keep this as **BEFORE**. Do not Clear logs yet if investigating an existing problem.
2. Click **Sample health for 5 minutes**, then close Settings. Sampling records anonymous health every 10 seconds and stops automatically; it remains available until Exit or another sampling session.
3. Perform one block below. Note the approximate local time of any failure and the exact visible message. Copy diagnostics immediately afterward as **AFTER**, before restarting. Copy after Stop as well if investigating automatic sync.
4. For another block longer than five minutes, start a new sampling session. Keep the previous copied report first. Clear logs is optional after collecting a report, followed by Test connection to verify logging continues.

Paste the complete output of **Copy diagnostics** (JSON), not screenshots of private settings or raw packet logs. It contains versions, safe event context, counts, sync revision and recent health samples; no URLs, character names, timer payloads, dataset IDs or owner credentials. If the backend cannot answer Copy diagnostics, use Open logs and paste the recent `mvp-tracker*.log` lines, plus the visible error. If Open logs also fails, the folder is `logs/` beside the executable.

## Test blocks

| ID | Actions | Expected result / what to record |
|---|---|---|
| A · window/local | Move and resize onto your chosen monitor; X, tray Show, Exit, relaunch. Add/edit a timer. Reopen Details. Optionally disconnect that monitor and relaunch. | Same normal position/monitor/size returns; disconnected monitor has a visible fallback. Spawned sorts above Spawn window. Gathered-only edits highlight for two seconds, ordinary ticks do not. Note DPI and monitor arrangement in words. |
| B · sync | Test connection; Sync; Start at 10 seconds for 30 seconds, manually Sync once, change to 20 seconds, then Stop. Repeat unchanged Sync. | `lastAt` advances; no overlapping/stuck busy state. An idle dataset revision stays constant. No-change polls intentionally produce no success log; health samples show activity. Record any other players/capture activity that could legitimately advance revision. |
| C · two players | Both use the same backend. Player A adds/edits a selected slot; B Syncs. B provides newer evidence; A Syncs. | Newer evidence wins with the intended killer/observer and kill/gathered time. Paste both reports labeled A/B, plus pass/fail for names/times; diagnostics intentionally excludes those values. |
| D · live capture | Sample, approach/revisit a grave, change channel, hide to tray and revisit, then Show. During normal use also try game restart/sleep-resume. | Capture Active and correct context return; observations refresh. `lastPacketAt`/counts may advance. Packet silence alone does not prove spawn. Note whether the table agrees with what you saw. |
| E · recovery/cleanup | Briefly disconnect networking during auto-sync, restore it, Sync and Stop. Delete outdated when an expired row and a fresh row coexist. Open logs, copy report, then Clear logs and Test connection. | Backoff/error while offline, then recovery; fresh rows survive cleanup. Explorer opens the correct folder; logs can be cleared and written again. Capture the report before clearing. |

Reset is a separate optional test on a disposable group database: confirm, verify other clients follow the new generation, then verify a retry cannot clear newer evidence. Do not reset the live group merely to test a desktop release. A separate clean Windows 11 x64 launch/Exit is still needed before publishing a tested release.

## Paste this with your reports

```text
Version: 0.1.8.2
Test block(s):
Windows / DPI / monitor arrangement:
Time of issue (America/Sao_Paulo):
Expected:
Observed / exact message:
Other players or live capture active during test?:
Reproducible?:
BEFORE: [paste Copy diagnostics JSON]
AFTER: [paste Copy diagnostics JSON]
```

Interpretation: healthy snapshots usually show `storageWritable: true`, `trayReady: true`, `resetPending: false`, and a recent successful `sync.lastAt`. Waiting/stopped are normal; a single busy sample during a request is normal. Repeated timeout/network/quota entries without recovery need investigation. `suppressed` summarizes repeated equivalent failures. Revisions/counts are aggregate evidence, not proof that every player's observation is correct.
