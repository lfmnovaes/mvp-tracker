# MVP Tracker third-party notices

MVP Tracker is Copyright (C) 2026 Luis Fernando and distributed under GNU AGPL v3 only; see LICENSE.txt. Source and build instructions are included in each portable package's source directory and published at https://github.com/lfmnovaes/mvp-tracker.

`src/backend/neutralino-client.ts` adapts the extension transport from kar-mi's spirit-vale-overlay at revision `4f1f8000bbdb19f7234aa9e73ddb89106fe3d389`, originally `apps/desktop/src/backend/neutralino-client.ts`, licensed GNU AGPL v3. Changes add timeouts and size bounds. All other Step 1 app source and the icon are new; no game artwork is included.

Bundled components: Neutralinojs 6.9.0, @neutralinojs/lib 6.9.0, Preact 10.29.8 and Bun 1.4.2. Their license texts are in licenses/ in the portable package. Bun contains third-party components covered by its bundled license notice. Windows WebView2 and .NET Framework are platform prerequisites and are not redistributed.

Build-only dependencies include @neutralinojs/neu (MIT), TypeScript (Apache-2.0), @types/bun (MIT), and the dependencies pinned in bun.lock. The build does not ship node_modules. See dependency-provenance.md for exact source references and later planned integrations.
