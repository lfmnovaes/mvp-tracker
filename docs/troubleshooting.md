# Troubleshooting

| Symptom | Action |
|---|---|
| Backend unavailable | Exit via tray, reopen the fully extracted runtime in a writable folder; keep extensions/backend/index.js and bundled executables |
| Missing functions/version | Owner deploys matching source with npx convex dev --once; Reset cannot repair a deployment |
| Network/timeout/quota | Check saved URL and access; requests time out after eight seconds; auto-sync backs off |
| Clock error | Correct Windows time; display timezone is fixed to America/Sao_Paulo |
| Empty observation/expiresAt | Expected after kill +150 minutes; Delete outdated removes the retained label |
| Capture inactive | Verify Npcap WinPcap compatibility, game and adapter; Retry capture and revisit the grave |
| No current character | Anonymous sharing is supported; an optional valid manual name can be entered in Capture |

Settings → **Diagnostics** provides Open logs, Clear logs, Copy diagnostics and five-minute health sampling. Open logs requests Explorer at logs/ beside the executable. Clear logs removes only the five known rotating app logs.

Logs retain at most five 2 MiB files for seven days. Context includes event, severity/version, component, operation, failure category, safe request ID/duration/counts and, when available, reason/error type/system error code. Fatal compiled frames retain only backend:line:column. No raw exception strings, personal paths, URLs, names, packet or clipboard data are recorded.

Capture reasons: relay-duplicates (VPN/proxy duplicates), unattributed-traffic/unowned-socket (process attribution), litenet-decode/fishnet-decode (decoder), target-scan (process discovery), npcap-missing/npcap-access/adapter-missing (setup), pending-expired/unknown-context (revisit after context settles), timestamp-invalid/observation-invalid (rejected evidence), sleep-clock/packet-stall (recovery). Unknown library warnings use driver-warning.

Equivalent errors are throttled for 60 seconds with a suppressed count. Different reasons remain distinct. Unchanged sync is quiet; health samples expose counts and revision. A new observation, expiry or deletion can legitimately advance revision.

For reproducible reports, follow [testing.md](testing.md). Capture describes packet collection; game describes process detection. The header shows Starting… before its first backend snapshot, Backend reconnecting… after connection loss, and Shell ready while connected. Shell ready does not guarantee capture or the native tray: check Diagnostics → System tray separately. None of these labels proves a boss is alive.
