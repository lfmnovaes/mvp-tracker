## What's Changed

- Fixed fresh grave observations becoming Outdated during sync after a database Reset.
- Fixed capture context loss across map notifications, unrelated transports and initial game discovery.
- Extended early-grave buffering to 30 seconds and added replay aging.
- Added experimental X/Y ground coordinates, with Not located when unavailable; narrowed Level, Region and CH columns.
- Enlarged status text while keeping rows compact.
- Limited row highlights to Gathered at changes and extended them to three seconds.
- Added Settings → Colors with six intervals; default three minutes per color across the fixed ten-color palette.
- Removed living-boss detection and safely discard its retired data.
- Updated Convex reset filtering and coordinate sharing: run **npx convex dev --once** and upgrade all sharing clients; no Reset needed.
- Added regression tests for sync data loss, capture context, coordinates, color settings and migration.
