# Dependency verification

Verified 2026-09-27 against upstream Git commits, public npm metadata and the installed lockfile.

| Component | Version / revision | Use |
|---|---|---|
| Spirit Vale Overlay | eaa93919cb9a943e9bc9510351288177ca46c9d6 | September 21 package-update reference |
| Spirit Vale Tools | 6e075bea7e81270b5fca81a49e1e2f5bc6fde10b | Current game protocol/catalog source |
| Capture | 3.0.3 | Passive capture and grave decoding; AGPL-3.0-only |
| Character | 0.6.1 | Local identity; unchanged |
| Items / Skills | 0.1.12 / 0.2.5 | Compatible character dependencies; AGPL-3.0-only |
| Neutralino runtime / lib | 6.9.0 | Latest stable, unchanged; MIT |
| neu CLI | 11.7.2 | Latest stable, unchanged; MIT |
| Preact | 10.29.8 | Latest stable, unchanged; MIT |
| Convex / convex-test | 1.46.0 / 0.0.60 | Current compatible runtime/test helper |
| Bun / Node typings | 1.4.2 / 24.19.0 | Current Bun typings and latest Node 24 typings for LTS 24.21.0 |
| Vitest | 5.0.2 | Current patch release |
| Bun / TypeScript | 1.4.2 / 7.0.2 | Existing pinned build tools |

The overlay updates capture 3.0.2 → 3.0.3 and catalogs for the September 21 game build. The bundled build fingerprint is ce04a28c94ea82848b85c29d2867d2c9061a8972b998b30e898fcb3f65a166ba. PlayerController.ChannelList_T moved from wire hash 31 to 35; a synthetic wire-to-tracker test verifies the new mapping and grave slot assignment. The upstream mob changes affect loot; supported boss IDs/names/levels are unchanged.

Exact versions and published integrity hashes are in bun.lock. No combat/rewards package or collector is installed. Source attribution for the original transport/catalog remains in THIRD_PARTY_NOTICES.md. Required notices and corresponding source accompany release binaries.

- [Overlay package update](https://github.com/kar-mi/spirit-vale-overlay/commit/eaa93919cb9a943e9bc9510351288177ca46c9d6)
- [Capture patch notes](https://github.com/kar-mi/spirit-vale-tools/blob/6e075bea7e81270b5fca81a49e1e2f5bc6fde10b/packages/capture/CHANGELOG.md)
- [Game protocol update](https://github.com/kar-mi/spirit-vale-tools/commit/57c7e40442bc681c8876b5b100773ae30f6f00bc)
- [Neutralino 6.9.0](https://github.com/neutralinojs/neutralinojs/releases/tag/v6.9.0)

Boss locations were joined by stable monster IDs from [SpiritValers monsters](https://spiritvalers.com/wiki-data/monsters.json) and [spawns](https://spiritvalers.com/wiki-data/spawns.json), verified 2026-09-27. All 33 supported bosses resolve to one overworld location. The Echoing Spire arena variants are excluded; the seven endgame masters keep Dark Fortress. Robot Dragon remains excluded and has no listed spawn. Map labels do not change slot identity or the sharing protocol.
