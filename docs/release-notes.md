## What's Changed

- Added 5-second auto-sync and removed the 5-minute interval; existing 5-minute preferences migrate to 2 minutes.
- Gave Hotkeys, Capture and Diagnostics their own Settings sections.
- Added capture warning reasons and safe exception context to logs, while preserving privacy and throttling.
- Reduced the portable download to runtime files, help and required license notices; matching source/documentation is a separate ZIP.
- Extended release manifests, checksum verification and CI uploads to cover both archives.
- Consolidated documentation and moved the plan to docs/plan.md, with one agent-led acceptance/UX test step.
- Documented every database table/field and proposals for gravestone coordinates and live-boss detection.

Windows 11 x64, portable and unsigned. Extract the full windows-x64 ZIP; retain data/ when upgrading after Exit. WebView2/.NET are required, plus separately installed Npcap for capture. Source/build instructions are in the matching source ZIP. Existing protocol-2 Convex deployments need no redeployment.

Draft pending Step 10 live capture, multiplayer, desktop and clean-machine acceptance.
