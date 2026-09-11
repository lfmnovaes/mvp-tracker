# Step 6 — Convex backend and connection

Version 0.1.6. Implemented cloud database schema/indexes, owner-only non-destructive initialization, key-checked discovery/snapshot/sync/reset functions, generation/reset-cutoff protection, revision deltas, expiry during sync, bounded reset receipts and server-assigned submission metadata.

The desktop saves an initially empty URL/key in a separate portable secrets file, reveals it only in Sharing settings, performs read-only Test, reports safe actionable errors, rejects redirects and invalid origins, and cancels stale connection responses. Capture/local writes remain independent of network Test. Live/cached/manual character identity is displayed; uploads require a name, while authorized reads do not.

TypeScript, 50 Bun tests (357 assertions) and 6 Convex tests pass. Coverage includes URL/key bounds, separate secret persistence and exclusions, changing connection during Test, read-only requests, initialization/version/key/quota/clock errors, repeat evidence/attribution, ID collisions across slots, invalid-batch rollback, unselected slot preservation, full/delta/no-op responses, expiry, reset-generation/cutoff protection and retry receipt bounds. A database field-order mismatch discovered by the repeated-sync test was fixed by canonical evidence comparison.

The owner setup guide is `docs/convex-setup.md`. No deployment credentials are present and no real database was created, deployed or reset. The opt-in integration script requires a separate server-marked disposable deployment plus explicit local reset consent. Mocks do not prove real Convex limits/concurrency. Manual Windows layout/capture and actual group setup tests remain with the user.

Step 7 retains the desktop Sync/Start/Stop and confirmed Reset workflows, durable acknowledgements, applying concurrent local edits, scheduling/backoff and idle server expiry cleanup. These controls remain disabled in 0.1.6. No production or paid deployment is configured.

Windows build/package passed. The 0.1.6 ZIP contains 94 entries, including the native/Bun runtime, Convex source and generated interfaces, owner setup guide and Convex license. Archive inspection confirmed exclusion of data, logs, deployment credentials and local secrets; only the blank integration example is included.
