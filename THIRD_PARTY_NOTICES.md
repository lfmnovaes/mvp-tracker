# MVP Tracker third-party notices

MVP Tracker is Copyright (C) 2026 Luis Fernando and distributed under GNU AGPL v3 only; see LICENSE.txt. Matching corresponding source and build instructions are provided in the source ZIP alongside each portable release and at https://github.com/lfmnovaes/mvp-tracker. Required dependency licenses remain in the portable licenses directory.

`src/backend/neutralino-client.ts` adapts the extension transport from kar-mi's spirit-vale-overlay at revision `4f1f8000bbdb19f7234aa9e73ddb89106fe3d389`, originally `apps/desktop/src/backend/neutralino-client.ts`, licensed GNU AGPL v3. Changes add timeouts and size bounds. All other Step 1 app source and the icon are new; no game artwork is included.

`src/domain/catalog.ts` extracts boss IDs, display names and levels from kar-mi's spirit-vale-tools `packages/rewards/src/catalog/definitions/mobs.ts` at revision `87db1d724d5738ec8b5f3cb258e357e757813264` (published rewards catalog 1.4.1), AGPL-3.0-only. Changes omit Robot Dragon and all rewards/combat data, and add the agreed seven-boss Dark Fortress map/preset/code supplement. The map label is confirmed by `packages/capture/src/fishnet/generated/map-names.current.ts` at the same revision. The region/server aliases follow the upstream overlay timer contract. No rewards runtime is bundled.

Bundled components: Neutralinojs 6.9.0, @neutralinojs/lib 6.9.0, Preact 10.29.8 and Bun 1.4.2. Their license texts are in licenses/ in the portable package. Bun contains third-party components covered by its bundled license notice. Windows WebView2 and .NET Framework are platform prerequisites and are not redistributed.

`src/spiritvale/` incorporates the required capture source and historical wire fixtures from kar-mi and contributors’ AGPL-3.0-only spirit-vale-tools packages/capture, revision 6e075bea7e81270b5fca81a49e1e2f5bc6fde10b (capture 3.0.3). Copyright attribution is retained in that folder’s README. Local changes add raw-frame diagnostics/Npcap statistics and a reviewed public-build RPC profile. Local identity is implemented separately in identity.ts. No @kar-mi npm dependency, items/skills runtime or combat/reward collector remains. The complete modified corresponding source is included in this repository and its source archive. Npcap is a separately installed prerequisite, not redistributed.

The experimental coordinate adapter uses capture packet spawn/transform position fields. Its ground-plane interpretation follows the overlay minimap's world X/Z usage; it does not claim calibrated game-map coordinates.

The capture adapter's ChannelList_T zero-based channel interpretation and connection admission handling follow spirit-vale-overlay's apps/launcher/src/desktop/capture-coordinator.ts at revision 4f1f8000bbdb19f7234aa9e73ddb89106fe3d389 (GNU AGPL v3). This implementation trims unrelated trackers, adds bounded transport replay suppression, requires explicit region/channel evidence, and separates live/cached identity.

Build-only dependencies include @neutralinojs/neu (MIT), TypeScript (Apache-2.0), @types/bun (MIT), and the dependencies pinned in bun.lock. The build does not ship node_modules. See dependency-provenance.md for exact source references.

The runtime bundles the Convex 1.46.0 JavaScript HTTP client (Apache-2.0); its license is included in the portable licenses directory. The Convex API/server bootstrap output is generated from that package's templates. Test-only packages are convex-test 0.0.60, Vitest 5.0.2 and @edge-runtime/vm 5.0.0, with exact transitive versions in bun.lock; they do not run in the portable application.

The synthetic wire encoders in tests/capture-protocol.test.ts follow packages/capture/src/fishnet/mapping/bundled-rpc-map.test.ts at tools revision 6e075bea7e81270b5fca81a49e1e2f5bc6fde10b (AGPL-3.0-only). Test values are fabricated; no game traffic is included.

Boss location labels were verified against the SpiritValers community wiki monster/spawn datasets (https://spiritvalers.com/, 2026-09-27). Game names/data belong to the Spirit Vale developers. No wiki code or artwork is bundled.
