# Packet recording — 0.1.9.5 (unreleased)

## Record a crypt encounter

1. Exit older copies and run 0.1.9.5. In Settings → Capture, select the adapter carrying the game traffic. Check Capture active and Game running.
2. In Settings → Diagnostics, click **Start monitor all** before changing channel. The frame counter must increase; zero frames means capture is not collecting traffic.
3. Change to a channel with a crypt/cross. Approach it and click **Mark crypt encounter**. Walk away and return once. Record whether a timer appeared, the approximate encounter time, and the expected boss/region/channel.
4. Click **Stop & save recording**, wait for the ZIP filename, then **Open recordings**. Share that ZIP with the encounter notes for analysis. No recording is uploaded automatically.

The header shows recording time remaining even after Settings closes. X still hides to tray; recording continues until Stop or its limit. Recording starts disabled each launch. Avoid exiting during a recording; Exit flushes the folder, but may leave it without a ZIP.

## What is collected

Monitor all saves **all TCP/UDP frames on the selected adapter**, before process attribution, duplicate suppression or protocol decoding. It includes traffic from other applications. It does not monitor every adapter or inspect game memory. Npcap remains passive and non-promiscuous.

Recordings may contain private network data, IP addresses and player names. Stop promptly after reproducing the issue and share deliberately. Normal rotating logs continue to omit names, credentials and packet payloads.

Each session is saved separately under `logs/recordings/monitor-…/`:

| File | Purpose |
|---|---|
| wire-N.pcap | Original packet bytes, lengths and microsecond capture timestamps; separate segments for different link types |
| events.jsonl | Attribution decisions, game process/socket snapshots, duplicate/drop diagnostics, decoded game packets, raw decoder errors and encounter markers |
| summary.json | Stop reason, file/frame/event counts and any recording write failure context |
| Adjacent monitor-….zip | Completed session, prepared after Stop or an automatic limit |

Computer/capture health is sampled once per second: OS/build identity, CPU/memory counters, selected adapter, capture state and Npcap drop counts. Only the public Steam build is identified; publictest and Steam account IDs are excluded. Game files are hashed read-only; no binaries are included.

Sessions stop after **10 minutes or 128 MiB** of recorded data. Writes are buffered, flushed every second and closed on Stop. Storage failures stop recording without terminating capture. Individual invalid/oversized records increment Rejected records. Clear logs clears rotating application logs only; delete old recording folders/ZIPs manually when no longer needed.

## Offline analysis

Extract the ZIP to a separate folder, then run from the repository:

```powershell
bun run analyze:recording "C:\path\to\monitor-session"
```

The analyzer validates PCAP lengths, replays UDP through the local decoder and reports counts, unresolved RPC IDs and decoding failures. It selects recorded game UDP endpoints by default. `--all-udp` also examines unattributed relay traffic. It prints no player names, IP addresses or packet bodies and does not modify timers/database records. TCP is retained/countable but is not replayed as FishNet UDP.

## Current compatibility evidence

The upstream repository was deprecated on September 28. SteamDB's readable public snapshot showed build 25433400; it did not provide reliable current packet schemas. The installed **public build 25647861**, metadata version 31, supplied stronger evidence. Official [0.33.0 news](https://steamstore-a.akamaihd.net/news/externalpost/steam_community_announcements/1845383656380019) describes gameplay/backend changes, without a wire-protocol specification.

Read-only native-code inspection verified **ChannelList_T changed from wire ID 35 to 38**. ID 38 failed the previous channel/grave regression and passes the corrected decoder. Its integer-array, channel-index and string writers are unchanged. TraverseActive remains 4; QuitCharacter_Rpc remains 12. BossKillInfo still declares KillTime, KillerName, BossName and BossId.

The current profile admits only RPCs required by timers/context/position decoding. Other RPCs remain raw and unresolved instead of using obsolete numeric IDs. September 21 prefab/SyncType layouts remain the decoding baseline: field names alone do not verify serialized indexes or prefab order. Live grave capture and coordinates remain pending a real recording; **0.1.9.5 must not be tagged or released until confirmed**.

## Maintaining game mappings

The owned module is `src/spiritvale/`; [its README](../src/spiritvale/README.md) records origin, scope and protocol profiles. Current constants and writer/send RVAs are in `protocol/public-25647861-evidence.json`.

For a later public update, use the official [Il2CppDumper](https://github.com/Perfare/Il2CppDumper) offline against a copy of GameAssembly.dll and global-metadata.dat to generate dump.cs. In an isolated developer Python environment, install `capstone==5.0.6`, then run:

```powershell
python scripts/inspect-game-rpcs.py GAMEASSEMBLY METADATA DUMP_CS STEAM_APP_MANIFEST EVIDENCE_JSON
```

The script rejects non-public branches, derives FishNet send addresses, verifies constant RPC IDs and records the binary hash. Review the output and parameter/layout evidence before adding a new profile and wire regression. Neither Python nor these research tools are required by the app or its build. Do not distribute game binaries or treat inferred/unknown layouts as verified.
