# Local Spirit Vale capture module

Copyright (C) kar-mi and contributors, and (C) 2026 Luis Fernando for local changes. Licensed under AGPL-3.0-only; see the repository LICENSE.txt and THIRD_PARTY_NOTICES.md.

The transport/decoder source and historical unit fixtures derive from [spirit-vale-tools packages/capture](https://github.com/kar-mi/spirit-vale-tools/tree/6e075bea7e81270b5fca81a49e1e2f5bc6fde10b/packages/capture), revision 6e075bea (capture 3.0.3). Required capture code is maintained here; no kar-mi npm package remains. Catalog and overlay-derived attribution are documented separately in the repository notices.

| Folder/file | Responsibility |
|---|---|
| capture/ | Windows/Npcap FFI, link/IP/TCP/UDP parsing, adapter selection, process/socket attribution and duplicate suppression |
| litenetlib/ | Reliable-channel/datagram/fragment decoding |
| fishnet/ | Session/object/RPC/SyncType/transform decoding and historical generated layouts |
| protocol/ | Reviewed current public-game RPC profile and reproducible evidence |
| identity.ts | Local-player object binding and DisplayName only |
| pcap.ts | Bounded offline PCAP reader |

Only timers, grave coordinates and local identity feed the application. Historical full layouts support wire parsing and regression fixtures; no combat/rewards/items/skills tracker runs. Current RPC decoding is restricted to verified timer/context/transform methods. Unknown packets remain available to opt-in raw recordings.

The default profile is public Steam build 25647861, identified by GameAssembly SHA-256 6202eb64513ca6f5d338dbd44b500a3201157d99f8e7b572364e60a224654c8b. ChannelList_T uses 38. Prefab/SyncType layout baseline remains September 21 pending live evidence. The older canonical source-manifest fingerprint ce04a28c… remains available explicitly for historical tests; it is not a GameAssembly file hash or an automatic fallback.

Local additions provide passive raw-frame hooks before filtering, detailed attribution/decoder tracing, Npcap statistics and the current scoped protocol profile. App lifecycle, bounded file recording and UI controls live outside this module in src/backend and src/ui. [Recording and protocol maintenance](../../docs/packet-recording.md).
