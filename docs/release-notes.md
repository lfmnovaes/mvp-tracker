MVP Tracker 0.1.8.2 — unsigned portable Windows 11 x64 build.

This patch adds repeatable Windows release builds, SHA-256 checksums, source/dependency manifests, and a concise diagnostic test plan. Existing window placement and timer presentation improvements are included. No Convex redeployment is required when already using the matching Step 7 backend.

Extract the entire ZIP into a writable folder and open MVP Tracker.exe. WebView2/.NET are required; automatic capture also requires separately installed Npcap with WinPcap compatibility. Exit before upgrading and preserve data/. Corresponding source, licenses and build instructions are inside the ZIP.

This release is a draft pending user acceptance of live capture, multi-player sync, monitor/tray behavior, and clean Windows 11 startup/Exit. The Windows CI runner validates compilation/tests/package integrity; it does not establish those interactive results.
