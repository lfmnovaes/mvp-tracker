# Step 7 follow-up: URL-only setup

The user's owner deployment exposed TS2591 because the Convex-specific tsconfig did not explicitly include Node types under TypeScript 7. Previous checks covered the desktop config only. Added pinned @types/node and `types: ["node"]` to the Convex config; the normal type-check command now checks both projects. Type-checking is not disabled.

Removed group-key fields/validation/transport and server environment checks, the disposable-integration flag, `.env.integration.example`, and its script/package command. Sharing protocol advances to 2 so the desktop requires matching URL-only backend functions. Character attribution remains nullable. Existing connection files migrate to `data/sharing.json` without retaining their key.

Settings → Sharing now has one URL field, Test connection and confirmed Reset database, saved with the main Save settings button. Reset can run directly after setup, without uploading local observations first. Reset still uses generation/cutoff checks and durable receipts; schema deployment remains an owner CLI action. No unrelated application tables are deleted.

Added `.env.local.sample` with an empty CONVEX_URL. The owner's existing `.env.local` is preserved. CONVEX_DEPLOYMENT remains necessary for the configured CLI workflow; CONVEX_SITE_URL is unused. README now separates first/subsequent portable runs, source runs and owner-only deployments.

Verification: both TypeScript configurations and 73 tests (63 Bun, 10 Convex) pass. Focused new tests cover migrating/removing an obsolete key file and confirmed reset before any sync, including rejecting a different dataset. Existing unit tests cover URL-only requests, null attribution, version mismatch, atomic merges and safe reset retries. The Windows portable package is rebuilt and inspected for required files and excluded local configuration. No manual GUI, live deployment or real database reset was performed.

The Convex-generated files from the user's attempted setup are preserved and included. Historical Step 6/7 verification documents describe the behavior at those commits; README and convex-setup.md are the current instructions.
