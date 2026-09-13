# Capture experiments and next improvements

## Implemented experimentally — 0.1.9.1

**Proposal 2: coordinates.** Join object spawn/partial transforms to the same gravestone object within the current connection/map/channel. Store world x/y/z; display ground X/Y = world X/Z and elevation in Details. Missing, invalid or nested positions show Not located. There is no player-position fallback or calibrated game-map origin/scale.

**Proposal 3: Alive.** Require an exact catalog boss ID/level, explicit server ownership and positive health no greater than max health. Accept health/identity joins within two seconds; emit at most once per five seconds per object. Transform traffic alone does not refresh a sighting. Alive lasts one minute, then Last seen alive until five minutes, then evidence is discarded. No kill time is invented. A newer grave/manual kill replaces a sighting.

Both experiments default on and have separate Capture switches. Disabling affects new local collection, not existing/imported observations. Object joins are capped at 2,048, age out after five idle minutes, and reset on authentication/map/channel changes or object reuse. Bad experimental data cannot suppress valid graves. Anonymous counters help distinguish missing entity/position/health evidence without logging payloads.

Validate both in [Step 10](testing.md): known landmarks, fresh/revisited graves, map/channel changes, dead/owned/unknown entities and cross-client expiry. Packet-contract tests demonstrate implementation behavior, not confirmed live-game coverage.

## Capture investigation

Compared upstream HEADs on 2026-09-13: overlay 4f1f8000 and tools 87db1d72. Capture 3.0.2 and character 0.6.1 remain current for these sources.

Confirmed app-side defects: TraverseActive cleared channel/region despite being a map notification; unrelated transport openings replaced the game connection; initial process discovery erased already-decoded context. These paths also exist in 0.1.8.2, so no specific 0.1.9 regression is established. Fixed context admission/reset rules, increased pending-grave tolerance from 10 to 30 seconds and expired transport replay identities after 15 seconds.

Existing sanitized logs contained five pending-expired and three unknown-context warnings, consistent with those failures. They also contained 95 unattributed-traffic and six relay-duplicates warnings. App fixes cannot recover packets never attributed/captured by the upstream process-filtered driver. Retain process filtering; collect a bounded health sample if misses persist.

## Remaining priorities

| Priority | Improvement |
|---|---|
| 1 | Surface the current allowlisted capture warning reason beside Retry |
| 2 | Validate ground axes against live landmarks; calibrate map coordinates only with evidence |
| 3 | Validate live health/spawn coverage and tune sighting freshness from observed behavior |
| 4 | Saved filter presets and next-window summary, subject to Step 10 UX findings |
| 5 | Shared access controls and adaptive idle sync |
| Later | Additional timezones, Portuguese, optional alerts and signing |

## Source references

- [Overlay capture coordinator](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/apps/launcher/src/desktop/capture-coordinator.ts): connection admission and channel/map handling.
- [Capture package](https://github.com/kar-mi/spirit-vale-tools/tree/87db1d724d5738ec8b5f3cb258e357e757813264/packages/capture): grave/monster decoding, ownership, spawn/transform and health contracts.
- [Overlay source](https://github.com/kar-mi/spirit-vale-overlay/tree/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389): minimap world X/Z ground plane and transform joins.
