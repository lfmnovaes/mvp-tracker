# Convex setup

The app needs only a saved HTTPS *.convex.cloud URL. Character names are optional. Anyone with the URL can read, upload and reset tracker data; there are no accounts or group keys.

## Owner setup

Install dependencies from the repository, then select a cloud development deployment:

```powershell
npx convex dev --configure --dev-deployment cloud --once
```

After backend changes: **npx convex dev --once**. Keep the CLI-generated .env.local: CONVEX_DEPLOYMENT selects the deployment; CONVEX_URL is a convenient copy of its URL. CONVEX_SITE_URL is unused. The optional [.env.local.sample](../.env.local.sample) is a reference, not a replacement for existing configuration. Desktop users need no .env file or CLI.

A URL cannot deploy functions/schema. See [Convex project configuration](https://docs.convex.dev/production/project-configuration) and [schema deployment](https://docs.convex.dev/database/schemas).

## App controls

- **Save settings:** persist URL locally, then check/initialize metadata in the background. Empty URL disconnects. Changing URL stops automatic sync and cancels old requests.
- **Test connection:** read-only URL/protocol/schema/catalog/clock check. Save URL edits first.
- **Reset database:** confirmation, drain active sync, clear shared tracker evidence, advance generation, preserve retry protection. Does not deploy code or delete unrelated tables.
- **Sync / F9:** merge selected current evidence while preserving other rows.
- **Start / Stop:** automatic intervals 5s, 10s, 20s, 30s, 1m, 2m; default 1m and stopped on launch. Manual clicks coalesce; interval changes apply live. Stop prevents future work, but an in-flight reply may finish.
- **Delete outdated:** remove expired placeholders locally and remotely; current evidence survives. Local cleanup works without a URL.

Transient failures use bounded backoff, up to five minutes; incompatible versions pause automatic mode. At continuous 5s polling, one client makes approximately 518,400 scheduled calls per 30 days before retries; 1m makes 43,200. Measure deployment usage during [Step 10](testing.md); fixture sizes do not establish free-plan capacity.

0.1.9.1 uses sharing protocol 3 with database metadata schema 1. The owner must run **npx convex dev --once** from matching source, and all sharing clients must upgrade. The optional position/Alive schema extension preserves existing rows; **do not Reset for this upgrade**. [Data/field audit](data-model.md) · [Troubleshooting](troubleshooting.md).
