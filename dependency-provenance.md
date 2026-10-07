# Dependency provenance

Updated 2026-10-06. Exact installed versions/integrities are pinned in bun.lock. No @kar-mi package remains.

| Component | Version/revision | Use |
|---|---|---|
| Local capture | src/spiritvale, local-1 | AGPL-derived transport/decoder; capture 3.0.3 source at 6e075bea7e81270b5fca81a49e1e2f5bc6fde10b |
| Local identity | identity.ts | Local object binding/DisplayName only; no items/skills dependency |
| Public protocol profile | Steam build 25647861, metadata 31 | Verified ChannelList_T ID 38; scoped RPC map and writer/send evidence |
| Neutralino runtime/lib/CLI | 6.9.0 / 6.9.0 / 11.7.2 | MIT; unchanged |
| Preact | 10.29.8 | MIT; unchanged |
| Convex / convex-test | 1.46.0 / 0.0.60 | Runtime/test helper; unchanged |
| Bun / Node typings | 1.4.2 / 24.19.0 | Pinned for Bun 1.4.2 and Node 24 LTS |
| TypeScript / Vitest | 7.0.2 / 5.0.2 | Build/test; unchanged |

The original upstream repository is [deprecated](https://github.com/kar-mi/spirit-vale-tools). Required source is now maintained locally; historical full layouts remain for parsing and explicitly historical tests. Current RPC decoding admits only methods needed for timers/context/positions. Unknown RPCs stay raw/unresolved.

The installed public GameAssembly SHA-256 is 6202eb64513ca6f5d338dbd44b500a3201157d99f8e7b572364e60a224654c8b. Prefab/SyncType layout compatibility still requires a live recording. [Protocol/recording evidence](docs/packet-recording.md) describes the offline inspection and limitations.

All 33 boss locations were joined by stable monster IDs from [SpiritValers monsters](https://spiritvalers.com/wiki-data/monsters.json) and [spawns](https://spiritvalers.com/wiki-data/spawns.json), verified 2026-09-27. Dark Fortress retains the seven endgame masters; arena variants/Robot Dragon remain excluded.

Corresponding local source and legal attribution remain in [notices](THIRD_PARTY_NOTICES.md). Offline research used official Il2CppDumper 6.7.46 and Capstone 5.0.6; neither is bundled or required at app runtime.
