# Release procedure

Target: unsigned, portable Windows 11 x64. Build with Bun 1.4.2 and Node 24 LTS. Update versions together in `package.json`, `neutralino.config.json` and `src/shared/protocol.ts`; add concise bullets to [CHANGELOG.md](CHANGELOG.md).

```powershell
bun install --frozen-lockfile
bun run check
bun run benchmark
bun run setup
bun run package
bun scripts/test-recording-worker.ts
./scripts/verify-portable.ps1 -ArchivePath release/MVP-Tracker-VERSION-windows-x64.zip
./scripts/test-package.ps1 -ArchivePath release/MVP-Tracker-VERSION-windows-x64.zip
```

Packaging generates runtime/source ZIPs, a dependency/per-file SHA-256 manifest and checksums. Runtime contains the executable, resources, required Bun/C# helpers, backend/recording worker and license texts. Source/docs are a separate download. State, logs, recordings, credentials, game binaries and node_modules are excluded. Never rebuild over a portable folder containing user state.

Commit and push main. After Windows CI passes, tag that commit `app-vVERSION` and push the tag. The tag workflow repeats checks, verifies provenance/checksums and creates a draft with four assets. Review its concise **What's changed** bullets and publish. Existing release assets are never overwritten automatically.

CI validates both archives, executable architecture, versions, matching source and rejection of tampered content. It cannot verify live game/Npcap behavior; perform a brief gravestone/tray/hotkey smoke check when those paths change. Capture protocol updates need real encounter evidence and parser regressions before publishing.

Exit before upgrading and preserve `data/`. Changes to Convex functions require an owner redeployment; state this inline in the relevant release bullet. UI-only releases do not require it.
