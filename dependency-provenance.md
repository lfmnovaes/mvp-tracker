# Dependency verification — Step 0

Verified on 2026-09-10 against the public npm registry and upstream Git refs.

| Component | Verified version / revision | License | Use |
| --- | --- | --- | --- |
| spirit-vale-overlay | `4f1f8000bbdb19f7234aa9e73ddb89106fe3d389` | AGPL-3.0 | Reference; adapt only the Neutralino extension transport in Step 1 |
| spirit-vale-tools | `87db1d724d5738ec8b5f3cb258e357e757813264` | AGPL-3.0-only packages | Passive capture integration in Step 3 |
| @kar-mi/spirit-vale-tools-capture | 3.0.2 | AGPL-3.0-only | Reserved for Step 3 |
| @kar-mi/spirit-vale-tools-character | 0.6.1 | AGPL-3.0-only | Reserved for Step 3 |
| @kar-mi/spirit-vale-tools-rewards | 1.4.1 | AGPL-3.0-only | Verified; excluded from this application |
| Neutralino runtime / @neutralinojs/lib | 6.9.0 | MIT | Native WebView2 shell and extension transport; matches upstream |
| @neutralinojs/neu | 11.7.2 | MIT | Build-time CLI; matches upstream |
| Preact | 10.29.8 | MIT | Tracker and Settings UI |
| TypeScript | 7.0.2 | Apache-2.0 | Type checking |
| Bun | 1.4.2 | MIT (bundled components have additional notices) | Build tools and portable backend runtime |
| Convex | 1.45.0 | Apache-2.0 | Installed and pinned in Step 6; HTTP client and owner CLI |

No combat, rewards, overlay, launcher or game assets will be copied. The capture packages' compatible versions are identified but will not be installed before their implementation step. Pin shell dependencies exactly and commit the Bun lockfile in Step 1. Keep upstream transport attribution in its adapted source, distribute AGPL license text, and include dependency notices and source/build instructions in packages.

Step 6 (0.1.6): installed registry releases Convex 1.45.0, convex-test 0.0.57, Vitest 5.0.0 and @edge-runtime/vm 5.0.0 with exact versions/integrities in bun.lock. Verified the installed HTTP client supports per-instance fetch and logger:false. The app adds redirect/origin/timeout controls. Generated API/server bootstrap files use the pinned CLI templates; schema-derived types are refreshed by normal owner deployment. Tests use the documented edge-runtime environment. No deployment or package-install login credentials are stored in source.

The upstream desktop shell already uses Neutralino 6.9.0, neu 11.7.2, Bun and Preact. Its existing extension handshake is the compatibility reference. Runtime package smoke testing belongs to Step 1; packet behavior belongs to Step 3.

Sources: [overlay source](https://github.com/kar-mi/spirit-vale-overlay/tree/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389), [overlay license](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/LICENSE.txt), [tools source](https://github.com/kar-mi/spirit-vale-tools/tree/87db1d724d5738ec8b5f3cb258e357e757813264), [npm registry](https://registry.npmjs.org/), [Neutralino window API](https://neutralino.js.org/docs/api/window/), [Neutralino extensions](https://neutralino.js.org/docs/how-to/extensions-overview/).

Step 2 (0.1.2): extracted the 33 supported boss ID/name/level records from the pinned spirit-vale-tools catalog into src/domain/catalog.ts and verified the complete set against that source. Dark Fortress is the only confirmed boss-to-map supplement. This adds no runtime dependency on the rewards package.

Step 3 (0.1.3): reverified public npm latest as capture 3.0.2 and character 0.6.1, installed exact versions, and committed their resolved dependency integrity hashes in bun.lock. Character also resolves the items and skills packages; no combat/rewards packages are installed. Runtime imports use the published Bun capture entrypoint and public character tracker. No decoder assets require runtime downloads. Package setup and tests do not start live capture. The backend loads the native runtime on demand so missing Npcap can be reported without disabling the shell. The source references above remain the capture/character compatibility reference.
