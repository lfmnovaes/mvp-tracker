## What's Changed

- Fixed capture context being lost on map notifications, unrelated transport openings and initial game-process discovery.
- Extended early-observation buffering to 30 seconds and bounded replay suppression by age.
- Added experimental X/Y ground coordinates, with Not located when reliable position is unavailable.
- Added experimental Alive sightings from validated boss identity and positive health; sightings age to Last seen alive after one minute and expire after five.
- Preserved position, observer and Alive evidence through local storage, JSON/compressed sharing and Convex.
- Added independent Capture toggles, anonymous diagnostic counters and failure isolation for experimental decoding.
- Narrowed Level, Region and CH columns; enlarged status text without increasing row height.
- Added regression tests for capture transitions, evidence validation, compatibility, expiry and cloud sharing.

**Convex upgrade:** the owner must run **npx convex dev --once** from matching source; all sharing clients must upgrade to protocol 3. Existing database rows are preserved; Reset is not required. Local timers/full exports use schema 2 and read schema 1; back up data before downgrading.

Windows 11 x64, portable and unsigned. Exit before upgrading; retain data/. Extract the full runtime ZIP. WebView2/.NET and separately installed Npcap are prerequisites. The source ZIP contains matching build instructions.

Draft pending Step 10 game/desktop/multiplayer acceptance. Coordinates are world X/Z, not a calibrated map grid; Alive is an observation, not a continuous-presence guarantee.
