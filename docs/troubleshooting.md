# Troubleshooting

- **Backend unavailable:** Exit from tray and reopen the fully extracted ZIP. Keep the app in a writable folder. Copy diagnostics if it recurs.
- **Sharing setup/version error:** The owner runs `npx convex dev --once` from the configured repository. Then Save settings / Test connection. Do not Reset merely to fix missing functions or a version mismatch.
- **Network or timeout:** Confirm the deployment URL in Settings and internet access; the app uses an eight-second request timeout. Automatic sync backs off. A clock error means Windows time needs correcting.
- **Outdated rows:** Observation/expiry fields intentionally clear 150 minutes after kill time. Delete outdated removes retained labels. Reset clears all group observations after confirmation.
- **Capture inactive:** Check Npcap's WinPcap compatibility option, game status and selected adapter. Retry capture, then revisit a gravestone. Packet silence alone does not prove a boss spawned.
- **Logs:** Settings → Capture & diagnostics → Open logs / Copy diagnostics. Logs include app version, allowlisted operation/category, UUID request correlation, elapsed milliseconds, HTTP status and bounded counts when relevant. Repeated identical failures are summarized at most once per minute. Routine unchanged syncs do not create log entries. Files remain capped at five 2 MiB files and seven days.
- **Clear logs:** Removes only the app's rotating logs. It does not clear timers, settings or anyone's database.

Diagnostic report schema 2 includes runtime/tool versions and anonymous capture/sharing/sync health. Raw exception strings, stack traces, URLs, owner credentials, names, packet data and clipboard text are omitted. Operation/request IDs let a reported failure be matched to a local log entry without including its input.
