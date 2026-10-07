# Local capture module

Copyright (C) kar-mi and contributors; (C) 2026 Luis Fernando for local changes. AGPL-3.0-only. Origin: spirit-vale-tools capture 3.0.3, revision `6e075bea7e81270b5fca81a49e1e2f5bc6fde10b`. [Full attribution](../../docs/overview.md#third-party-attribution).

- `capture/`: Windows/Npcap, network parsing and process/socket attribution.
- `litenetlib/`, `fishnet/`: fragments, sessions, objects, RPCs, SyncTypes and transforms.
- `protocol/`: reviewed public-build profile. `identity.ts`: local player binding/name. `pcap.ts`: bounded recording reader.

Only grave timers, coordinates and identity feed the app. Historical generated layouts support wire boundaries and fixtures; combat/reward collectors do not run. Unknown packets are available in opt-in recordings.

Current public build: **25647861**; GameAssembly SHA-256 `6202eb64513ca6f5d338dbd44b500a3201157d99f8e7b572364e60a224654c8b`. ChannelList_T uses **38**, not 35. Prefab/SyncType layouts retain the September 21 baseline; capture was confirmed in game. Historical source-manifest fingerprints are explicit test profiles, not game binary hashes or automatic fallbacks.

[Recording and maintenance guide](../../docs/diagnostics.md). Verify future public builds with `scripts/inspect-game-rpcs.py` and add wire-level regressions.
