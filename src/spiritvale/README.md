# Local capture module

Copyright (C) kar-mi and contributors; (C) 2026 Luis Fernando for local changes. AGPL-3.0-only. Origin: spirit-vale-tools capture 3.0.3, revision `6e075bea7e81270b5fca81a49e1e2f5bc6fde10b`. [Full attribution](../../docs/overview.md#third-party-attribution).

- `capture/`: Windows/Npcap, network parsing and process/socket attribution.
- `litenetlib/`, `fishnet/`: fragments, sessions, objects, RPCs, SyncTypes and transforms.
- `protocol/`: reviewed public-build profile. `identity.ts`: local player binding/name. `pcap.ts`: bounded recording reader.

Only grave timers, coordinates and identity feed the app. Historical generated layouts support wire boundaries and fixtures; combat/reward collectors do not run. Unknown packets are available in opt-in recordings.

Current public build: **25832491**; GameAssembly SHA-256 `f6842a80628ed034657b2eb083cdba9631609954262b1607477740f493b5850b`. ChannelList_T still uses **38**, with a new trailing packed `pvpIndex`. PlayerSave adds float32 `ArenaPeakRating` at SyncVar index 2. Other prefab/SyncType layouts retain the reviewed baseline. Profiles/evidence for public build 25647861 remain explicitly available for historical analysis. Historical source-manifest fingerprints are explicit test profiles, not game binary hashes or automatic fallbacks.

[Recording and maintenance guide](../../docs/diagnostics.md). Verify future public builds with `scripts/inspect-game-rpcs.py` and add wire-level regressions.

Fresh graves may carry kill info after spawning. The decoder retains unidentified inbound SyncTypes for up to two seconds and retries them only after a confirmed BossGraveStone spawn. The original capture timestamp is retained; no payload-shape inference identifies graves.
