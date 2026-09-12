# Candidate improvements

These are proposals, not features shipped in 0.1.9.

| Priority | Change | Benefit / validation |
|---|---|---|
| 1 | Capture reason surfaced beside Retry | Faster diagnosis without opening logs; use the new allowlisted warning reasons |
| 2 | Gravestone coordinates in Details and JSON | Identify the observed location; validate coordinate axes and object association first |
| 3 | Positive live-boss observations | Replace inferred spawn timing with observed presence when reliable packets identify a living boss |
| 4 | Next-window summary and saved filter presets | Faster navigation for groups tracking many bosses; validate usefulness in Step 10 |
| 5 | Shared access controls and adaptive idle sync | Reduce accidental resets and idle traffic as the group grows; preserve simple setup |
| Later | Other timezones, Portuguese, optional alerts, signing | Expand after Windows/private-group acceptance |

## Gravestone position

The pinned capture 3.0.2 packet contract exposes objectId, spawnLocalPosition and networkTransform position. The grave helper returns mob ID/name, killer and kill time only; MVP Tracker currently discards position.

A feasible implementation joins a grave with its object's spawn/transform position within the same connection, retains that position for later SyncType grave updates, and resets the object map on connection changes. Do not substitute the player's position.

World position is not automatically the map's displayed X/Y. Validate whether the ground plane uses X/Z, map origin/scale, nested object transforms and absent/partial position fields. Store world coordinates plus map/instance/observed time first; display map coordinates only after mapping is established. Unknown position stays empty. Version the shared/export model and retain backwards compatibility.

Acceptance: two graves at distinct known points, spawn and revisit updates, channel/map changes, reused object IDs, missing position, and matching screen-map landmarks.

## Seeing a live boss

Possible in principle: spawn/prefab data identifies entities, and upstream mappings include health/max-health sync fields. Current grave-only tracking does not reliably identify and track living bosses.

Prototype a separate evidence type using validated boss identity plus explicit positive health/alive evidence. Associate it with connection/map/channel/object ID; distinguish summons, pets and corpses. Positive sightings can invalidate an earlier grave prediction. Leaving render range, despawn, a missing grave or packet silence must not count as death or respawn.

Define merge/expiry rules for grave versus alive evidence before changing timers: later authoritative evidence wins, disappearance remains unknown, and a new kill starts a new cycle. Confirm packet fixtures and UI wording before deployment.

## References

- [Pinned Spirit Vale Tools source](https://github.com/kar-mi/spirit-vale-tools/tree/87db1d724d5738ec8b5f3cb258e357e757813264/packages/capture): packet/spawn/network-transform declarations, grave decoder and generated component mappings.
- Installed declarations inspected: @kar-mi/spirit-vale-tools-capture/dist/fishnet/schema/packets.d.ts, decoding/spawn.d.ts, decoding/network-transform.d.ts and tracking/boss-gravestone.d.ts.
- These API fields establish feasibility, not verified map coordinates or a working live-boss detector.
