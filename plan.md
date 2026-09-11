# MVP Tracker — implementation plan

Updated 10 September 2026 with the user's decisions. The original 18 questions are resolved and removed. Steps 0–2 are complete (current app version 0.1.2). Convex replaces Google Sheets entirely. Shared-group-key access is approved; no product questions remain open. A concrete Convex deployment URL/key will be needed later for live testing.

## 1. Agreed scope

Create a Windows 11 x64 desktop application for a small private group, adapting Spirit Vale Overlay's Boss Timers and using the latest verified published Spirit Vale Tools packages. The main window is **MVP Tracker**. It works locally without a database connection, remains active in the system tray, and supports manual entries, edits, and clipboard exchange.

| Area | Version 1 decision |
|---|---|
| Features | Boss tracking only. Remove overlay editing/toggles, DPS, rewards, character/build tools, minimap, unrelated collectors/settings/hotkeys. |
| Default bosses | Exactly the seven Dark Fortress Echo Masters: Berserker, Gunslinger, Necromancer, Paladin, Priest, Shinobi, Wizard. |
| Other bosses | Support every boss upstream supports except Robot Dragon. Echo Weaver Master is supported but unchecked and excluded from Endgame. |
| Boss settings | Scrollable checkbox list, level descending/name ascending; All, Endgame, None. Map column is blank when upstream provides no mapping. |
| Geographic regions | SA and NA selected initially; OCE, JP, EU, SEA supported but unchecked. Regions have their own selection controls. |
| Capacity | 42 is the default logical working set, not a hard limit. More selected bosses/regions create more slots. |
| Deselection | Hide existing local entries and stop accepting new observations for deselected bosses/regions; retain existing entries until expiry. Preserve other players' remote rows. |
| Clock | All version 1 displays/manual input use America/Sao_Paulo. Show a disabled timezone selector with that value. Store absolute UTC timestamps internally. |
| Time format | 24-hour default, optional AM/PM UI. Existing settings migrate once to 24-hour. Compact text export always uses 24-hour kill times. |
| Respawn | User-confirmed game rule: grave present means boss has not respawned; respawn occurs 60–90 minutes after death, for all supported bosses. |
| Expiry | At +90 minutes mark Spawned. Keep the kill information until +150 minutes, then discard its values and retain the boss slot labeled Outdated. |
| Edits | Add and Edit set kill date/time; confirmation automatically stamps the information time from the Windows clock. Manual and automatic evidence may replace one another. |
| Sharing | Configurable Convex cloud development URL plus shared group key, empty initially. Transactional manual sync and optional timed auto-sync: 10, 20, or 30 seconds; 1, 2, or 5 minutes. |
| Reset | Confirmed Convex reset mutation clears tracker observations and advances dataset generation, retaining schema/catalog labels. Owner deploys functions separately with `npx convex dev --once`; this command does not erase records. |
| Text export | Selected Dark Fortress bosses only; kill time `HH:mm`; no `?` or other uncertainty markers; headers such as `SA UTC-3`. |
| JSON/compressed export | All selected supported bosses/regions, regardless of temporary search; include killer, observer/sender attribution, and merge metadata. |
| UI | Simple dark style with a distinct layout, English only; killer name visible and exportable; no sound/desktop alerts. |
| Window | X/native Close/Alt+F4 hides to tray; minimize goes to taskbar. Optional start minimized means hidden to tray. No launch-with-Windows setting. |
| Hotkeys | Optional/rebindable F7 Show/hide Tracker, F8 Add manually, F9 Sync, available in version 1. |
| Distribution | Fully portable, unsigned Windows 11 x64 ZIP; Neutralino/WebView2 + Bun. No installer, ARM64, Windows 10 commitment, or Electron fallback in version 1. |
| Repository | `C:\Users\lfmno\Projects\mvp-tracker`, remote `https://github.com/lfmnovaes/mvp-tracker.git`, authenticated as `lfmnovaes` through Git Credential Manager. Commit and push after every completed step using a short progress message. |
| Source reuse | Preserve upstream attribution and AGPL notices; publish corresponding source/build instructions for the derivative. |

### Convex decisions and setup boundaries

Google Sheets, its access questions, table-formatting requirements, and future OAuth/coordinator backlog are removed. Use a shared **cloud development deployment** of Convex for the private group, not a separate local database per player. Every player connects to the same development URL and the owner deploys the matching MVP Tracker functions/schema first.

The user approved **one shared group key** alongside the URL, with no individual sign-in. Validate that key in every exposed tracker query/mutation, including Test, Sync, and Reset. All key holders have the same group permissions, including confirmed reset; viewer/admin roles are deferred. Character names are self-reported game attribution, not credentials. Fail closed if the server key is missing; never ship deploy/admin keys to players. [Function authorization](https://docs.convex.dev/auth/functions-auth).

Owner setup and player actions are different: `npx convex dev --once` pushes code/schema to a configured dev deployment and exits; application Reset calls a deployed mutation to clear tracker data. The portable app does not require npm/Node, repository source, or Convex deployment credentials. An empty Convex project URL is insufficient until the functions are installed. [CLI reference](https://docs.convex.dev/cli/reference/dev).

## 2. Upstream research and reuse

Research was performed on 9 September 2026 by downloading both public repositories. No upstream executables were run and no dependencies were installed. Research clones are at `G:\Documents\ChatGPT\mvp tracker\research`, outside the application checkout. Keep them out of application commits and releases.

| Source | Inspected version |
|---|---|
| Spirit Vale Overlay | Commit `4f1f8000bbdb19f7234aa9e73ddb89106fe3d389`, package/release `0.10.8`. |
| Spirit Vale Tools | Commit `87db1d724d5738ec8b5f3cb258e357e757813264`. |
| Published capture package | npm latest verified then: `@kar-mi/spirit-vale-tools-capture@3.0.2`. |
| Published catalog package | npm latest verified then: `@kar-mi/spirit-vale-tools-rewards@1.4.1`. |
| Target checkout at research time | Empty repository on `main` with the expected SSH remote; no application code to migrate. |

Recheck published versions at implementation start. Tools packages are independently versioned, so use registry metadata and the lockfile rather than GitHub's latest-release label alone. The tools release instructions describe npm and GitHub Packages publishing. Prefer verified public npm artifacts; use authenticated package access only if required. [Tools publishing](https://github.com/kar-mi/spirit-vale-tools/blob/87db1d724d5738ec8b5f3cb258e357e757813264/RELEASE.md).

Relevant source findings:

- The Bun backend uses Npcap for passive UDP capture targeting `SpiritVale.exe`, then FishNet decoding. Keep that flow; no game traffic injection or second decoder implementation.
- `decodeBossGravestone` supplies boss ID/name, killer, and server kill time. Handle both existing-grave `objectSpawn` snapshots and fresh-kill `syncType` packets.
- `ChannelList_T` supplies channel and instance context. Normalize aliases including `nova → sa`, `sun → na`, `aurora → oce`, `star → eu`. Authentication/disconnect resets context.
- Upstream keys a timer by boss ID, geographic region, and channel. Instance ID is diagnostic context, not the shared slot identity.
- Upstream lacks separate observation freshness and deduplicates repeated grave packets. Extend that deliberately; never refresh a check timestamp from a UI tick.
- Upstream's timer UI has a region dropdown but numeric channel/minutes-ago inputs and ascending boss choices. Replace the latter controls and add field editing.
- Upstream uses +60/+90 boundaries and removes entries at +105. MVP Tracker intentionally changes removal to +150 and retains an empty labeled slot.
- Upstream launcher Close exits the application. Adapt custom controls, native events, and shell exit settings for persistent close-to-tray.
- The catalog supplies 34 boss entries, names, IDs, levels, and flags, but no complete boss-to-map association. Excluding Robot Dragon gives 33 supported bosses. Map-name data identifies Dark Fortress as map 55.
- Rewards' catalog package has combat/items/logging/sqlite dependencies. Reuse its catalog without starting unrelated services; consider build-time extraction of the minimal catalog.
- The primary Windows shell is Neutralino/WebView2 with bundled Bun; Electron is an upstream fallback, not required here.

Pinned references: [timer contract](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/packages/contracts/boss-timers.ts), [timer coordinator](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/apps/launcher/src/desktop/boss-timer-coordinator.ts), [capture integration](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/apps/launcher/src/desktop/capture-coordinator.ts), [timer UI](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/apps/launcher/src/views/boss-timers/index.tsx), [gravestone decoder](https://github.com/kar-mi/spirit-vale-tools/blob/87db1d724d5738ec8b5f3cb258e357e757813264/packages/capture/src/fishnet/tracking/boss-gravestone.ts), [catalog](https://github.com/kar-mi/spirit-vale-tools/blob/87db1d724d5738ec8b5f3cb258e357e757813264/packages/rewards/src/catalog/definitions/mobs.ts).

Both projects use AGPL; the tool packages declare AGPL-3.0-only. Preserve copied-file attribution, record modifications, include license notices, and provide corresponding source/build material in releases. [Overlay license](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/LICENSE.txt), [capture package declaration](https://github.com/kar-mi/spirit-vale-tools/blob/87db1d724d5738ec8b5f3cb258e357e757813264/packages/capture/package.json).

## 3. Catalog and selection

Use canonical IDs for selection and merge identity. The Endgame preset contains exactly these seven entries, all level 155 and mapped to Dark Fortress:

| Name | ID | Text code |
|---|---|---|
| Echo Berserker Master | `NightmareBerserkerBoss` | `b` |
| Echo Gunslinger Master | `NightmareGunslingerBoss` | `g` |
| Echo Necromancer Master | `NightmareNecromancerBoss` | `n` |
| Echo Paladin Master | `NightmarePaladinBoss` | `pa` |
| Echo Priest Master | `NightmarePriestBoss` | `pr` |
| Echo Shinobi Master | `NightmareShinobiBoss` | `s` |
| Echo Wizard Master | `NightmareWizardBoss` | `w` |

Other supported choices, initially unchecked:

| Name | Level | ID |
|---|---:|---|
| Echo Weaver Master | 150 | `NightmareWeaverBoss` |
| Ice Titan | 140 | `Mega Ice Golem` |
| Turtle Champion | 140 | `Turtle King` |
| Cosmic Entity | 135 | `Alien Big Blink` |
| Suphara | 135 | `Spider Queen Robot` |
| Abyss Archon | 130 | `Death Mage` |
| Orc Warchief | 130 | `Goblin Warchief` |
| Wraith King | 125 | `Wraith` |
| Kraken | 110 | `Eyeball Monster` |
| Demon Lord | 105 | `Imp Devil` |
| Devourer | 95 | `Worm Creep` |
| Seraphim Arbiter | 90 | `Angel Mage` |
| Ice Mage | 80 | `Ice Mage` |
| Broodmother | 75 | `Queen Worm` |
| Zombie Orc Lord | 65 | `Zombie Goblin King` |
| Night Baron | 55 | `Bat Lord` |
| Orc King | 55 | `Goblin Giant Gold` |
| Naga | 50 | `Snake Naga` |
| Hermit King | 45 | `Hermit King` |
| Cactus King | 40 | `Cactus Boss` |
| Lady Fey | 40 | `Sunflora Pixie` |
| Scorpion King | 40 | `Scorpion King` |
| Raiju | 35 | `Cat Bolt` |
| Lycanthrope | 30 | `Werewolf` |
| Vorpal Hare | 30 | `Hare` |
| Vespa | 15 | `Sting` |

Reject `Dragon Predator Robot` (Robot Dragon) in capture acceptance, manual choices, import, and local export. Do not confuse it with Suphara (`Spider Queen Robot`), which remains supported. Preserve remote rows outside the local selection rather than treating unsupported/unselected data as permission to erase someone else's information.

Maintain a small supplement for known map labels. Leave unknown labels empty, as requested. A missing map must not prevent tracking, search by other fields, or export. All selects all 33 supported bosses; Endgame selects only the seven listed above; None unchecks all. Boss and region choices are separate; changing a boss preset does not reset the region selection. All regions use channels 1–3.

## 4. Main window, Settings, and tray

### Main window

Use a resizable dark window with a distinct compact tracker layout: title bar, capture-status strip, search/filter row, table, and persistent sharing toolbar. Settings cog, minimize, and X belong at the top right. No separate launcher or overlay. No encounter/Boss timers subheader or SA+NA timezone badge beneath the capture strip. On first launch, center the window; on later launches, restore the previous window position and size, recovering inaccessible bounds after monitor changes.

Capture status shows starting, waiting for game, game detected/waiting for usable packets, Capture Active, stalled, missing/unavailable Npcap, adapter failure, and backend reconnecting. Preserve useful upstream explanations. Capture, storage, and Convex sync status are independent; a successful sync never implies game capture is active. Normal game absence is informational rather than a repeated error log.

Table columns: Boss, Level, Map/Location, Region, Channel, Killer, Status/respawn range, Gathered at, Actions. Show gathered time including seconds in the column and full date/time in the tooltip and expanded Details, alongside kill time/source. Keep killer name visible; use an empty display when manual input has no known killer. A trash icon removes the local slot; subsequent capture/import/sync can restore it, without deleting shared data. Filters and actions remain fixed above/below the scrolling table, with slim side padding. New windows default to centered 1080 × 820; saved bounds take priority.

Sort Boss/Map/Region/Killer alphabetically, Level/Channel numerically, and gathered time by UTC timestamp. Every requested column supports ascending/descending order and remembers the choice. Default status sorting prioritizes Spawn window by due time, Waiting by eligibility, Spawned by due time, then Outdated/No data; stable boss/region/channel tie-breakers. Never sort formatted countdown strings. Tick updates must not steal focus.

Search normalizes case/accents, tokenizes ordinary input, and AND-matches tokens across boss/map/region/channel/killer. Support `paladin sa ch2`, `dark fortress`, `region:sa`, `ch:2`, plus explicit region/channel filters. Channel tokens must not match a level or clock. Distinguish no observations, no matches, None selected, and Outdated slots. Previously known slots may remain listed with cleared values; do not retain expired kills just to populate the table.

Bottom toolbar has two compact groups: Add manually / Export format / Export / Import, and Sync now / Auto interval / Start or Stop. Show last success, next sync countdown, and Sharing as character beneath the sync controls. Manual save is independent of sync. Sync/Start require a valid configured Convex URL/key. See section 6 for the scheduler behavior.

### Add and Edit

Use a focused dialog with Boss, Region, Channel, Kill date, Kill time, optional Killer, Save/Cancel. Boss choices obey Settings and sort level descending/name ascending; region/channel are dropdowns, channels exactly 1–3. Date defaults to Today with Yesterday available; seconds are optional. Use explicit AM/PM controls to guarantee the preference independently of OS input presentation.

Interpret manual times in America/Sao_Paulo regardless of the Windows display timezone. The Windows clock supplies the current instant when Save is confirmed; convert that instant to the fixed app timezone for display. Show the interpreted complete kill timestamp and expected spawn interval before saving. Validate noon/midnight, calendar rollover, future values, and invalid dates. Do not silently clamp future input to now. An already-expired kill results in an Outdated slot with no retained kill values and a clear explanation.

Each row has Edit for the kill date/time and optional killer. Keep boss/region/channel fixed during Edit; Add chooses a slot. Saving creates fresh manual evidence and stamps gathered time at confirmation; there is no editable gathered-time input. Captured evidence and manual evidence can replace one another using the merge rules below. Blank manual killer does not invent a killer; do not carry one across different deaths without evidence.

### Settings

- **General:** AM/PM versus 24-hour format, disabled timezone dropdown showing America/Sao_Paulo, UI scale, remembered window bounds, Start minimized (off initially), optional/rebindable F7/F8/F9 hotkeys, Exit MVP Tracker.
- **Tracking:** scrollable Boss/Level/Map/Track table with All/Endgame/None, plus region checkboxes defaulting to SA and NA. Apply changes to local display/ingestion/export immediately.
- **Sharing:** editable Convex URL and masked shared group key (empty initially), Test connection, deployment/schema status, Sharing as character (detected/cached/manual fallback), auto-sync interval preference, last sync summary, setup help, and Reset tracker data. No Google or individual account controls.
- **Capture/Diagnostics:** Auto/manual network adapter, restart capture, Npcap status/help, app/tool versions, Open logs, Export diagnostics, bounded diagnostic mode.

No launch-with-Windows setting, Portuguese localization, notifications/sounds, overlay hotkeys, or unrelated log/session controls. Retain manual adapter troubleshooting and UI scale because they directly support this application.

### Tray and hotkeys

Create the tray at startup and keep it present while running. X, native Close, and Alt+F4 hide to tray; minimize goes to taskbar. Tray double-click shows/focuses the main window; right-click offers Show MVP Tracker, Settings, Exit. Settings Close closes that window, not the application. Start minimized starts hidden with the tray visible. If tray creation fails, show a recoverable window instead of hiding permanently.

Enable configurable shortcuts in version 1: F7 toggles tracker visibility, F8 shows the tracker and opens Add manually, F9 triggers manual Sync. Allow each to be disabled/rebound; report registration conflicts and avoid repeat firing from key autorepeat. Test behavior with the game focused and whether the selected upstream hotkey helper passes the key to the game; explain the behavior in Settings. Do not silently replace the user's bindings on collision.

Only explicit Exit or OS shutdown ends normal operation. Stop capture, flush state, cancel/finish network work within a bounded timeout, remove tray, release shortcuts, and terminate child processes. Prevent duplicate instances and focus the existing instance on a second launch. Handle Explorer restart, sleep/resume, lost monitor bounds, and backend failure.

## 5. Data, time, capture, and merging

### Minimal model

Separate a permanent slot from its optional current observation. Slot identity is the deterministic tuple `mobId | normalizedRegion | channel`, with encoded components. Do not key by row number, display name, or instance ID. A UUID generated once per observation is useful for deduplication; no nanoid dependency is needed.

Observation fields: `observationId`, `mobId`, `region`, `channel`, `diedAt`, `gatheredAt`, `source` (`manual`/`gravestone`), `timePrecision`, optional `killedBy`, optional `observedByCharacter`, optional instance/map context. Convex adds submitted-character/server-acceptance metadata when accepting new evidence. A manual edit may carry `replacesObservationId` for diagnostics/conflict explanations. Store canonical timestamps as UTC instants and preserve timestamp precision from upstream.

Use separate local transport metadata (`receivedAt`, pending-sync state) and format/schema/catalog versions. Download/import/export time never replaces `gatheredAt`. Convex metadata holds dataset ID, generation, reset date, revision, and next expiry; every sync/reset mutation reads generation inside the transaction. Keep server acceptance time separate from observation freshness.

### Capture behavior

Adapt the upstream PacketCapture flow and health monitoring with minimal services. Add gathered time when a meaningful live grave observation arrives. Decode both spawn snapshot and SyncType; keep bounded retransmission deduplication and distinguish genuine revisits/object lifecycles from replayed packets. Do not update freshness every second unless a genuine fresh packet provides that evidence. Investigate periodic updates empirically; do not assume their cadence.

Use connection/channel/region context from upstream; clear stale context during transitions. Keep unknown region/channel observations unresolved locally until reliable context or explicit user placement exists. Never default ambiguous captured data to SA/channel 1. Accept selected bosses/regions only, and continue capture while hidden.

The user confirms gravestones disappear on respawn. A fresh grave observation therefore reports not-yet-respawned at that instant. Packet silence, leaving proximity, ordinary object despawn, disconnect, or capture failure alone must not be treated as positive respawn detection. Version 1 can derive Spawned at +90 without implementing disappearance detection. A fresh packet contradicting the 90-minute rule should produce a bounded diagnostic, not silently extend the timer; validate clocks/context/decoder first.

### Lifecycle and fixed timezone

For every supported boss:

| Age since kill | Status and retained information |
|---|---|
| Less than 60 minutes | Waiting; show earliest and latest respawn timestamps/countdown. |
| At least 60, less than 90 minutes | Spawn window; show remaining time to guaranteed spawn. |
| At least 90, less than 150 minutes | Spawned, based on the agreed game rule; keep kill/killer/gathered fields for sharing. |
| At least 150 minutes | Outdated; discard kill/killer/gathered observation values and retain only slot/catalog labels. |

Example: a Paladin kill at 21:35:22 has a window of 22:35:22–23:05:22, becomes Spawned at 23:05:22, and expires at 00:05:22 next day. A real recheck at 22:50 updates gathered time, never either spawn boundary or expiry. No check/edit/import can extend the same kill's lifetime past kill +150 merely by providing a new timestamp.

Re-evaluate age at startup, ingestion, sync, import, periodic cleanup, resume, and clock changes. Delete expired payloads from local persistence so opening the app next day has no old kill data. Empty slot labels can remain Outdated; no history/archive of expired kills is required. Compact reset metadata and log event counts are not kill history.

All displayed dates/manual inputs use America/Sao_Paulo, and any shared-data viewer uses the same zone. Use the zone's formatting rules rather than interpreting SA/NA as timezones; current compact export headers are `SA UTC-3`, `NA UTC-3`, etc. Keep UTC storage compatible with future zone selection, but disable selection now. Use absolute times rather than decrement-only countdowns; monotonic durations for retries/timeouts where available.

### Merge rules

Use one validated pure merge path for capture, manual entry/edit, clipboard import, persistence loading, and Convex snapshots/deltas:

1. Validate structure, supported schema, boss IDs, normalized region, channels 1–3, finite timestamps, string sizes, and future-clock bounds. Reject invalid records before mutation. Missing map labels are valid.
2. Group by deterministic slot. Compare genuine `gatheredAt` timestamps, not delivery time; the freshest admissible observation/report wins. A late import of an old report cannot defeat newer gathered information.
3. Manual Save/Edit is a deliberate fresh report and may correct the kill backward or forward, including replacing automatic evidence. Fresh automatic evidence may replace manual evidence. Do not hard-code source priority or require a newer kill timestamp for a deliberate edit.
4. Within an unchanged death report, a genuine later grave check advances gathered time while preserving kill time. Preserve each observation as a coherent record; never combine one death's killer with another death's kill time.
5. Equal IDs are no-ops; equal timestamps use a stable observation-ID tie-breaker so all clients converge for the same inputs. Equal-time conflicts can be counted/explained without inventing freshness.
6. Expired input never recreates an active timer and must not clear a different valid observation merely because it arrived later. A direct user Edit to an expired kill explicitly clears the local slot; its final expiry decision is distinguishable from an unrelated stale import.
7. Do not accept implausibly future gathered times as permanently winning evidence. Preserve raw upstream time for diagnosis and surface clock trouble rather than silently rewriting it. Core implementation accepts up to 30 seconds of future timestamp skew for incoming records; manual kill input allows no future time. This tolerance never extends the spawn or expiry boundaries.
8. Deselected remote slots remain untouched in the database even though hidden/not ingested as tracked local data; sync omission is not a delete. Local removal/hiding is not a shared delete operation. Per-row shared deletion is outside version 1; shared clearing occurs through expiry or Reset.
9. Every Convex sync validates expected dataset generation in its transaction. A reset advances that generation; a concurrent old-generation sync either commits before reset and is cleared, or rejects afterward. Expiry and original-evidence/reset-cutoff checks also prevent old clipboard data from silently repopulating the reset dataset.

Test deterministic/idempotent/commutative ordinary merges over valid observations. An explicit local edit/clear is an operation that creates new evidence; do not let arbitrary imports fabricate fresh receipt-based timestamps. Clipboard source labels are provenance, not authenticated proof.

## 6. Convex database and synchronization

### Owner setup and connection

Add `convex/` to the application repository with schema, validated queries/mutations, generated API types, and setup instructions. Pin the `convex` package and CLI through the project lockfile. Configure an explicitly selected **cloud dev deployment** under the owner's Convex project, then run `npx convex dev --once` from the source checkout. Re-running deployment must preserve existing timer data. Current CLI supports selecting local/cloud during configuration; a noninteractive unconfigured invocation can otherwise provision a local deployment, which would not share data across players. [Dev configuration](https://docs.convex.dev/cli/reference/dev), [noninteractive deployment behavior](https://docs.convex.dev/cli/agent-mode).

Owner-only initialization seeds catalog/metadata without wiping existing observations; provide a separate internal init command/function and an explicit owner reset command if useful. Store the shared group key (or a compatible deterministic hash) in deployment environment configuration; never in tracked source. Generate the actual key only during deployment setup. Keep `.env.local`, deploy keys, login state, user URLs, and secret files ignored. Use a persistent cloud dev deployment for the group and a separate disposable local/dev deployment for destructive tests. No production deployment or paid plan is requested.

Players paste the deployment URL, normally `https://<deployment>.convex.cloud`, and the shared group key into Settings. Do not accept dashboard URLs or mistake the `.convex.site` HTTP-action origin for the client deployment URL. Validate HTTPS/origin before sending the key and do not follow a redirect to an unrelated host with it. Settings begin empty. Changing URL/key stops auto-sync, invalidates cached connection state, and discards old in-flight responses using a connection generation; no requests may drift to a different configured group. Local timers remain available.

Use the generated API with `ConvexHttpClient` in the Bun backend for interval-driven calls; the documented client works in runtimes with fetch. No permanent realtime subscription is required in version 1, so Start/Stop genuinely controls background traffic. A future subscription can be assessed separately. [JavaScript clients](https://docs.convex.dev/client/javascript).

Test connection calls a small authorized query returning app/protocol/schema versions, initialized status, dataset ID/generation, and server time. It does not write or reset data. Missing functions: show owner setup instructions. Incompatible schema: ask to install the matching backend version, not clear the database. Valid compatible empty/old data: sync normally. Wrong key, unreachable URL, missing initialization, and quota/service errors each have a concise distinct message. Shared-key checks are custom application authorization; Convex does not automatically make a URL or character name private.

The user wants portable data. Keep the group key in a separate ignored local secrets file with a masked/reveal control and exclude it from timer exports/diagnostics/release artifacts. Document that someone copying that secrets file gains group access; allow deletion/rotation without losing timers. Never write the key or full function arguments into application/server logs. Dashboard/operator visibility of request data must be considered when choosing key transport; verify platform logging behavior before deployment.

### Data schema and character attribution

One deployment represents one shared tracker dataset initially. Suggested tables:

| Table | Purpose |
|---|---|
| `trackerMeta` | Singleton dataset/schema/catalog versions, generation, reset date, monotonically increasing revision, next active expiry, pending cleanup job reference if used. |
| `bossTimers` | One slot document per mob/region/channel; optional current observation, killer, observer/sender character, server acceptance time, last-change revision, derived expiry. |
| `resetReceipts` | Small bounded reset-request receipts so a timed-out Reset retry does not clear new data again. No permanent sync/event history. |

Use indexes by slot key, changed revision, and active expiry. Indexes are lookup structures, not unique constraints: lookup and insert/upsert must happen in the same mutation to maintain one document per slot. Strip expired observation values while retaining slot identity and a changed revision so clients receive the clearing as a delta. Server-side validation enforces all supported IDs, channels, regions, bounds, and the +150-minute expiry rule; never trust a client-supplied key inconsistent with its fields. [Convex indexes](https://docs.convex.dev/database/reading-data/indexes).

Upstream already supplies the local player name through `capture.subscribeCharacter`, and passes `state.snapshot?.name` to the boss timer coordinator. Reuse the character tracker only as needed to identify the local player; do not add character screens/stat calculation or confuse inspected players with the sender. [Upstream identity connection](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/apps/launcher/src/desktop/desktop.ts), [character package](https://github.com/kar-mi/spirit-vale-tools/blob/87db1d724d5738ec8b5f3cb258e357e757813264/packages/character/README.md).

Each outbound batch includes `sentByCharacter` captured when that request begins. Each accepted observation stores `submittedByCharacter` and `serverAcceptedAt`. Preserve optional `observedByCharacter` with the original captured/manual observation, including across JSON exchange. These differ from `killedBy`: the killer, observer, and person forwarding data may all be different. Identical observations resent by another client do not rewrite accepted attribution or bump revision merely to record routine polling. No unbounded “who synced” audit table.

Display Sharing as with the live name when known. Keep a clearly marked last-detected cached name for game-offline sharing, and permit an explicit manual fallback name when no live name has ever been captured. Never silently invent a character. Without any usable name, allow local work and an authorized pull-only snapshot, but hold uploads and show “Character name needed to upload.” Reevaluate on character switch/disconnect; snapshot the sender once per request so an in-flight upload is not relabeled. Name strings are bounded/validated; they are not account authentication. Include attribution in JSON/compressed output and row details while keeping compact text unchanged.

### Transactional merge protocol

Use one `timers.sync` mutation that validates access, reads metadata/current affected slots, merges candidates, clears due expirations, updates changed documents, and returns an authoritative revision plus snapshot/delta. This replaces the old download/full-table-overwrite design. Convex mutations provide atomic database transactions and serializable conflict handling, so the application can merge against current state rather than stale client snapshots. Deterministic domain freshness rules still matter: a transaction cannot decide whether a player mistyped a time. [OCC and atomicity](https://docs.convex.dev/database/advanced/occ), [mutations](https://docs.convex.dev/functions/mutation-functions).

Request: protocol/schema version, expected dataset ID/generation, last known revision, stable request ID, sender name, and new/changed selected observations. Initial discovery uses Test/snapshot metadata first; a client must not bind an unknown cache to a reset generation by assumption. Server never interprets omitted/unselected bosses as deletions.

Normal flow:

1. A single shared coordinator in the desktop accepts manual and timed sync requests. Snapshot the connection identity, character, generation, and pending observations.
2. Server verifies group key and argument limits, then generation. Reject stale generations with current metadata and no writes. Validate the batch before any mutation becomes committed.
3. Merge each candidate with current database evidence using section 5. Upsert only changed winners; preserve valid remote data for every unselected slot. Server controls acceptance timestamps/revisions, never overwrites gathered time with receipt time.
4. Clear due expired payloads as slot updates; advance revision only for actual changes. Return a full snapshot on initial/reset/resync request, otherwise changed slots since the client's revision or an unchanged response. Include cleared slots, generation/revision, and server time.
5. Desktop applies the result atomically with a durable acknowledgement watermark, merges against observations arriving during the request, and acknowledges only the outgoing records actually accepted/known by the server. Newer local edits remain pending. Store imported-but-not-newer data without re-stamping it.

Repeated observation IDs must be idempotent. For uncertain network failures, retry the same operation identifiers and verify state rather than recording another observation. A dropped response cannot advance a client's watermark past unapplied deltas. Reset uses a dedicated deduplicated request ID. Missing delta continuity/schema mismatch triggers a full snapshot; it never triggers a silent reset. Keep all database reads/writes in mutations rather than split across actions with a nontransactional gap.

### Automatic and manual sync UX

Default auto-sync is **Stopped**, with **1 minute** selected. Offer exactly six intervals: **10 seconds, 20 seconds, 30 seconds, 1 minute, 2 minutes, 5 minutes**. The 10-minute option is removed. Store the chosen interval; restart the application stopped so network activity resumes only after Start. Starting minimized affects the window, not this preference.

Toolbar example: `Sync now   Auto: [1 minute v] [Start]` plus `Stopped · Last sync 21:04:12 · Sharing as LuisCharacter`. Running changes Start to Stop and shows `Next sync in 00:42`. A compact spinner/status occupies the same space while a request is active. Start performs an immediate sync, then schedules the next interval after completion. Auto-sync continues in the tray while started.

Manual Sync/F9 remains usable while auto-sync runs. If idle, run immediately and rebase the next scheduled time from completion. If already syncing, coalesce the click into at most one follow-up sync and show “Sync queued”; additional clicks do not enqueue more requests. Timer ticks during a running sync coalesce and never overlap network requests. Retain pending local changes for the follow-up.

Changing the dropdown while running cancels the previous scheduled callback and sets the next due time to now plus the new interval; if a request is active, finish it and schedule using the new interval from completion. Do not stop/restart the session or require another Start. Stop prevents further scheduled/queued automatic work but lets an in-flight mutation settle and applies its acknowledgement; it cannot undo a write already accepted. Manual sync stays available after Stop. Do not automatically retry after Stop without a manual request.

Implement the scheduler with one replaceable timeout and explicit states: Stopped, Waiting, Syncing, Backoff, Paused/error. Use schedule/connection generation tokens to neutralize stale callbacks. During sleep/offline, accumulate no backlog of missed ticks; on resume/reconnect, do at most one catch-up if still started. Network failures use bounded exponential backoff/jitter; wrong key, incompatible backend, or reset requiring attention pauses auto-sync with a visible reason. Avoid repeated popup dialogs. Retry/load tests should model manual requests and changed intervals during backoff too.

### Reset and physical expiry cleanup

Settings Reset tracker data displays the destination deployment/dataset and confirms clearing **all MVP Tracker observation fields**, including those from other players. It pauses scheduling and drains the current request before calling `tracker.reset`. Reset is a mutation that clears timer payloads, retains catalog/slot labels, sets reset date, advances generation/revision, and records its idempotency receipt. It does not redeploy code, delete schema/indexes, rotate the group key, or erase unrelated application tables.

Every sync transaction reads generation, so an old-generation request cannot repopulate the dataset after Reset. On a generation change, discard old upload eligibility and refresh local state; do not keep an old kill in the active table and then re-upload it as new. Newly received foreign clipboard records retain their original evidence time and must pass the reset cutoff. A deliberate new manual entry or newly observed grave can repopulate normally. After a user's Reset, auto-sync stays stopped until Start, so clearing the database is visible and predictable.

Client display always evaluates +150-minute expiry. Server clears expired observation values during sync, and a single coalesced scheduled internal cleanup at the next expiry keeps the database clean even with no clients open. Reschedule only when the earliest expiry changes; cleanup verifies generation/slot observation before clearing, so a delayed job cannot erase a newer kill. Retain no expired kill history. Bound all operations for the full supported set (33 bosses x 6 regions x 3 channels = 594 slots) and confirm transaction/function limits; if future growth exceeds that bound, use a staged maintenance design before increasing capacity. [Scheduled functions](https://docs.convex.dev/scheduling/scheduled-functions).

### Free-plan usage and validation

Convex currently advertises a Free plan and a separate Starter pay-as-you-go option. The pricing page lists included resource allowances such as 1 million function calls, 0.5 GB database storage, and 1 GB each of database I/O and egress for the entry tier. Verify the actual selected free account limits in the dashboard at setup and remain on Free; do not enable billing automatically. Small storage does not guarantee low traffic. [Current pricing](https://www.convex.dev/pricing).

At one call per interval, uninterrupted polling for 30 days costs approximately 259,200 calls/client at 10 seconds, 129,600 at 20 seconds, 86,400 at 30 seconds, 43,200 at 1 minute, 21,600 at 2 minutes, and 8,640 at 5 minutes, before tests/retries/cleanup. Four always-running clients at 10 seconds reach 1,036,800 calls, above the currently listed 1-million entry-tier allowance. The faster options remain available as requested; keep the 1-minute default and show a concise estimated-usage hint in Settings. A repeated 20 KB full snapshot at one minute is roughly 864 MB/client/month before overhead; use revision/delta responses instead.

No-change sync should read small metadata and return unchanged without scanning 594 documents or updating a “last sync” timestamp. Store next expiry in metadata; query changed-revision/expiry indexes only when needed. Send only pending observations; preserve their acknowledged IDs locally. Initial/new-selection/recovery fetches can request snapshots; normal polls should be cheap. Monitor calls, database I/O, egress, and retries with measured payloads during the private beta. A single mutation per ordinary tick avoids a mandatory query-then-mutation round trip.

Use `convex-test` with Vitest for server schema, auth helper, merge/reset logic and scheduled cleanup; keep Bun tests for core/desktop behavior. Mocks do not enforce all backend limits or prove actual concurrent transaction behavior, so later run multi-client tests against a disposable real dev deployment. User will verify the shared cloud connection manually; no cloud deployment/database has been created or reset during planning. [Convex testing](https://docs.convex.dev/testing/convex-test).

## 7. Clipboard export/import

Export uses the selected bosses/regions from Settings, independent of the temporary table search. Exclude Outdated/No data records. The compact text is a special subset: only the selected seven Dark Fortress bosses, ignoring Weaver and all other bosses even when they are tracked.

Text contains **kill times**, always 24-hour `HH:mm`, grouped by region/channel and sorted by full kill timestamp before formatting:

```text
SA UTC-3
Ch1: 20:31(s) - 20:43(g) - 21:15(n) - 21:18(pr) - 21:48(b) - 21:55(w) - 22:02(pa)
Ch2: 21:21(s) - 22:07(g) - 22:07(n) - 22:11(b) - 22:25(pa) - 22:29(w) - 22:31(pr)
Ch3: 21:01(g) - 21:01(pr) - 21:10(n) - 22:20(b) - 22:39(s) - 22:43(pa) - 22:44(w)
```

No uncertainty symbols, question marks, dates, killer names, or extra payload in this concise format. Include another compact region header when needed. Omit empty channels/regions and nonexistent records; sort by full timestamp across midnight even though the text deliberately omits the date. Use only `b`, `g`, `n`, `pa`, `pr`, `s`, `w`. Text is not importable. JSON/compressed export carries the additional detail, including killer names and observer/sender attribution.

JSON contains an application/format identifier, schema/catalog versions, export time, optional dataset generation provenance, and observations with original kill/gathered times, killer names, and observer/sender attribution. Export time is metadata, not freshness. Exclude local filesystem paths, group access or deployment credentials, network addresses, and unrelated settings. Include enough UTC/precision metadata for deterministic merging on another machine.

Compressed format: `MVPT1:<base64url(gzip(UTF-8 JSON))>`. Step 5 uses the pinned Bun runtime's bundled `node:zlib`; native expansion bounds and checksum validation are tested, with no extra dependency. The explicit prefix supports future migrations; gzip's checksum detects accidental corruption. Compression is not encryption/authentication. The user's original random-looking string was illustrative, not a required wire format.

Export copies to clipboard and reports record count or clipboard failure. Import opens a multiline input dialog, trims outer whitespace/BOM, detects JSON/compressed content, validates completely, previews added/refreshed/ignored/conflicted counts, and merges on confirmation. Cancel leaves state unchanged. Reject plain text with a concise explanation. Do not automatically read or transmit arbitrary clipboard content.

Bound encoded input, decoded output, nesting, string lengths, and record count; enforce decompression limits during expansion, not only afterward. Reject corrupt base64/gzip, unknown versions, invalid dates/channels, Robot Dragon, and malformed identities. Skip disabled/expired entries with visible counts. Repeat imports must not duplicate records or refresh gathered time.

## 8. Architecture, portable persistence, and logs

Recommended source layout:

```text
apps/desktop/              Neutralino shell, Bun backend, Preact views
packages/tracker-core/     Catalog, schemas, time, merge, search/sort
packages/capture-adapter/  Spirit Vale Tools, context, health
packages/storage/         Atomic saves, migrations, recovery
packages/sharing/         Clipboard codecs, Convex client and sync scheduler
convex/                   Database schema, queries/mutations, generated API
tooling/release/           Windows build/package/verification
tests/fixtures/            Synthetic packets and Convex responses
docs/                     Setup, QA, release routine
plan.md                   This accepted specification and progress
```

Pin the latest verified published capture/catalog dependencies and the lockfile at implementation start. Keep the upstream decoder behind a narrow adapter; no runtime dependency auto-updater. Reuse relevant small persistence/window/tray helpers with attribution. Remove unrelated UI assets, services, and startup side effects. Capture/package incompatibility should leave manual/clipboard functionality available with an actionable warning.

Versioned JSON plus serialized atomic save/last-known-good recovery is adequate for this small current-state store. Persist settings, live records, known slot labels, and bounded sync metadata separately as appropriate; no historical kill database. Recalculate expiry before writing/loading, so expired observation payloads do not survive in normal state or long-lived recovery backups. Quarantine corrupt files only for explicit short-lived recovery and avoid treating that as automatic history retention.

Use `data/` and `logs/` beside the portable executable by default. No automatic AppData fallback: if the extracted folder is read-only, show a clear message to move it to a writable folder and do not pretend state was saved. Bundle Bun and app resources; the end user needs no development runtime. A portable upgrade copies preserved nonexpired data/settings into the new extracted version while both versions are closed; do not overwrite a running executable or let two versions capture/write the same data concurrently.

Store the shared group key separately from transferable timer/settings exports; never include it in release assets or diagnostics. Full portable folder copies containing the secrets file intentionally copy group access too. Convex deployment credentials belong only on the owner/developer machine and never ship with the desktop app.

Essential structured logs: UTC timestamp, severity/event code, app/tool version, local correlation ID, sanitized error/stack, and bounded counts/durations. Log lifecycle transitions, meaningful capture health changes, decoder/schema failures, storage/migration problems, sync/reset outcomes, clock anomalies, and import failures. Deduplicate repeated warnings. Do not log every packet, timer tick, repeated grave, or normal game-not-running state repeatedly.

Do not log raw game traffic, shared group/deployment keys, full private deployment connection details, clipboard payloads, killer/player names, IPs, usernames, or personal absolute paths by default. Killer names belong in the tracker and authorized exports, not diagnostic logs. Sanitize external error messages. Proposed caps: 2 MiB per file, five rotating files, seven days maximum age, enforcing both size and age. Log failures/disk full must not crash capture.

Provide Open logs and Export sanitized diagnostics with versions, adapter/health summaries, and bounded recent errors. Optional diagnostics is time-limited and automatically disables; raw packet collection is not a default feature. Do not auto-upload diagnostics.

## 9. Implementation steps and acceptance gates

Testing policy (user decision, 2026-09-10): prefer only unit tests that protect important domain or persistence behavior. Manual testing belongs primarily to the user, later in implementation; perform desktop interaction only when absolutely necessary. Deferred manual checks do not block these early steps and must never be reported as passed. App versions follow `0.1.<step>` during this phase (Step 1: 0.1.1; Step 2: 0.1.2).

After every completed step: run its relevant checks, update progress in this file, commit with a short message describing the change, and push to the configured repository. Inspect user changes first, stage only that step's files, and never force-push. If a push fails, retain the local commit and report the exact blocker; do not call it pushed. Use `main` for this initial agreed work unless isolation becomes necessary; any newly needed branch uses `codex/`.

### Step 0 — Record decisions and prepare the repository

- [x] Replace the proposal with this `plan.md` and remove answered questions/the obsolete file.
- [x] Resolve shared access: Convex development deployment plus a shared group key; Google integration removed.
- [x] Configure repository-local Git author as Luis Fernando with the supplied email. No global Git identity changes.
- [x] Prepare the revised Convex/character/auto-sync plan for this documentation step. Commit/push message: `docs: plan Convex sync and character attribution`.
- [x] Reverify published dependencies and upstream compatibility before copying code; record licenses/provenance in `dependency-provenance.md` (2026-09-10).

Gate: an agreed specification and the plan in the intended repository. A concrete owner-created Convex deployment and key are needed later for live integration, not to finish local implementation or internal tests.

### Step 1 — Minimal portable Windows shell

- [x] Scaffold trimmed Neutralino/Preact/TypeScript/Bun app, version metadata, dark tracker layout, icon, and notices.
- [x] Implement single instance, tray lifecycle, Settings shell, close-to-tray, taskbar minimize, optional start minimized, and F7/F8/F9 configuration.
- [x] Add typed UI/backend/clipboard boundaries, portable storage roots, errors, and essential log rotation.

Gate: implementation, type checks, focused unit tests and Windows build/package checks pass. Remaining manual desktop tests belong to the user later in development.

**2026-09-10 status: Complete (0.1.1).** Existing desktop checks are documented in `docs/step-1-verification.md`; remaining manual checks were deferred by the user. Removed the redundant encounter/Boss timers subheader and region badge; retained the titlebar, icon and capture strip. First launch centers the window, while Neutralino remembers its previous position and size. Development uses directory resources explicitly to avoid the missing `resources.neu` warning.

### Step 2 — Catalog, timer core, and persistence

- [x] Add all 33 bosses, exact Endgame allowlist, Robot Dragon exclusion, known map supplement, region preferences.
- [x] Implement UTC storage/fixed São Paulo formatting, +60/+90/+150 lifecycle, cleared Outdated slots, validation, and atomic persistence/recovery.
- [x] Implement gathered-time merges, edits that can correct either direction, deduplication, expiry, search/sort helpers, and meaningful tests.

Gate: boundaries, fresh-versus-old evidence, manual/automatic replacement, disabled choices, and restart cleanup pass through focused unit tests; TypeScript and Windows build checks pass. Commit/push.

**2026-09-10 status: Complete (0.1.2).** Implemented the minimal catalog, selectable boss/region preferences, timer domain and portable timer persistence, settings migration, shared freshness/expiry rules, and table search/sort consumers. Timestamp skew tolerance is explicitly 30 seconds for incoming records; manual future kills are rejected. See `docs/step-2-verification.md`. No new manual desktop testing was required. Actual capture remains in Step 3; the full Add/Edit dialog and row actions remain in Step 4.

### Step 3 — Passive capture and health

- [x] Integrate current tools capture APIs; extract process/adapter/health/context handling from upstream without combat/reward collectors.
- [x] Handle existing grave spawn snapshots, fresh-kill SyncType, retransmits, revisits, context resets, unknown slots, and gathered-time stamps.
- [x] Extract current local character identity using the upstream character tracker; distinguish live/cached/manual fallback identity, inspected players, killer, observer, and upload sender.
- [x] Maintain capture when hidden and recover on game restart/sleep; provide Npcap/adapter failures clearly.

Gate: synthetic capture fixtures pass. Real packet cadence/revisits/region switching remain explicitly marked for Windows user testing until exercised. Commit/push.

**2026-09-10 status: Complete (0.1.3).** Passive capture, context/identity routing, bounded retries and replay handling, one-second batched timer persistence/publication, adapter settings and health UI are implemented. Early unknown-context graves are held in memory for up to 10 seconds/64 markers within the same connection; unresolved entries are then skipped and may require a revisit. Cached identity is labeled for this session and remains distinct from live observer evidence. Sharing uploads and sender persistence remain in Steps 6–7. TypeScript, 31 focused tests and Windows build/package checks are recorded in `docs/step-3-verification.md`. Live game and desktop checks remain deferred to the user.

### Step 4 — Complete tracker and Settings interactions

- [x] Implement sortable/filterable table, visible killer, capture strip, details, Outdated/empty states, footer controls.
- [x] Implement Add/Edit kill date/time, 24-hour default (updated in Step 5 follow-up), optional AM/PM display, selected-boss/region/channel dropdowns, Save-time evidence stamps.
- [x] Complete scrollable boss/region settings, disabled timezone selector, scale, hotkeys, start minimized, diagnostics, and Exit.

Gate: all local flows work with fixtures/capture disabled, keyboard navigation and input validation pass, and live updates preserve focus. Commit/push.

**2026-09-10 status: Complete (0.1.4).** Add/Edit is wired through validated backend requests and the existing timer store, with explicit time formats and preview, fixed Edit slots, automatic confirmation timestamps, row Details, explicit region/channel filters, focus-preserving draft/row state, interface scale and sanitized diagnostics. TypeScript and 36 focused tests (260 assertions) pass; Windows build/package checks are recorded in `docs/step-4-verification.md`. Per the user's testing policy, actual desktop keyboard/focus/scale and live game tests remain deferred to the user, not reported as passed. Clipboard and Convex footer controls remain disabled until Steps 5–7.

### Step 5 — Clipboard exchange

- [x] Implement selected Dark Fortress kill-time text, `UTC-3` headers, JSON and compressed exports with killer names.
- [x] Add bounded codecs, import preview/validation/merge, clear rejection messages, and clipboard failure handling.

Gate: two independent states exchange data repeatedly without duplicate/freshness inflation; text ignores non-Endgame bosses, invalid input causes no mutation. Commit/push.

**Complete (0.1.5).** Clipboard exchange is implemented with validated preview/confirmation and original evidence timestamps. Timer rows are slimmer; timezone and character context replace the negligible window footer labels, with no internal table status bar. TypeScript and 41 tests / 285 assertions pass; see `docs/step-5-verification.md`. Manual desktop checks remain deferred to the user.

**2026-09-11 follow-up:** local row deletion, 24-hour default/migration, time-only Gathered at, fixed filters/actions, a scrolling table with sticky headings, slimmer sides and 820px default height. TypeScript and 44 tests / 303 assertions pass; see `docs/step-5-follow-up.md` for behavior and all header statuses. Version remains 0.1.5. Manual desktop checks remain with the user.

### Step 6 — Convex backend and connection

- [ ] Add Convex schema/functions/generated types and documented owner setup targeting a cloud development deployment with `npx convex dev --once`.
- [ ] Implement key-checked Test/snapshot/sync/reset functions, indexed slots, revisions/deltas, transactional merges, attribution, reset generation, and bounded idempotency.
- [ ] Implement client URL/key settings, secrets exclusions, sender display/fallback, initialization/version errors, and connection-generation protection.
- [ ] Add convex-test/Vitest validation and a separate disposable deployment configuration for integration tests; keep the shared group deployment intact.

Gate: missing/wrong keys fail closed; valid candidates merge without clobbering unselected slots; repeated requests preserve attribution; no player needs npm or a deploy key. Test mocks and live checks are clearly distinguished. Commit/push.

### Step 7 — Manual/automatic sync, reset, and expiry

- [ ] Implement one shared manual/automatic sync coordinator, six intervals (10s/20s/30s/1m/2m/5m), Start/Stop, next-sync display, coalescing, live interval changes, backoff, sleep/reconnect, and safe shutdown.
- [ ] Implement atomic delta application/acknowledgements, capture/edit-during-sync handling, no-op polling optimization, and bounded reset receipts.
- [ ] Add confirmed reset mutation and next-expiry scheduled cleanup; generation checks protect new data against old requests/jobs.
- [ ] Verify sender snapshots, no fabricated identity, wrong-key pause, and reset leaving auto-sync stopped.

Gate: deterministic scheduler/backend tests pass; manual sync can run alongside automatic mode without overlapping calls; stale-generation sync/reset retries cannot erase or resurrect new observations. Measure traffic for 42 and 594 slots. Commit/push.

### Step 8 — Windows and private-group validation

- [ ] Run the matrix below; fix discovered failures and record exact tested Windows/runtime versions.
- [ ] Have the user manually test the real shared Convex development URL/key, sender names, multiple players, interval changes, Start/Stop, and reset; exercise actual transaction races on a disposable deployment.
- [ ] Validate fresh grave, revisit, channel/region transition, game restart, Npcap failure, tray capture, sleep/resume, DPI, and portable upgrade on Windows 11.
- [ ] Inspect logs/exports/package for accidental credentials or local data; write concise setup/troubleshooting instructions.

Gate: no unresolved local data-loss bug; sync limitations accurately documented; unperformed live tests explicitly listed. Commit/push.

### Step 9 — Repeatable unsigned Windows releases

- [ ] Add CI, manual dry run, portable packaging, artifact verification, checksums/licenses/source manifest, and tagged publication.
- [ ] Produce a test artifact, validate on a clean supported Windows machine, then publish the agreed version.

Gate: a clean checkout produces a verified portable ZIP; the user can run it with documented system prerequisites and preserve data through an upgrade. Commit/push before the release tag.

## 10. Tests and verification

Use Bun tests for the core/desktop and synthetic capture fixtures, plus convex-test/Vitest for Convex functions. Internal tests require neither Npcap nor cloud credentials. Add focused UI tests with a mocked desktop bridge and fake-clock scheduler tests. Real tray/capture requires Windows, and real Convex concurrency/limits requires a disposable deployment; the user performs actual group validation later.

| Area | Required coverage |
|---|---|
| Timer boundaries | Before/at/after +60, +90, +150; Spawned retention; Outdated payload clearing; no extension by a newer grave check. |
| Time | Fixed America/Sao_Paulo on Windows machines set to another zone; UTC round trips; AM/PM noon/midnight; date rollover; optional seconds; future input; sleep/clock jumps. |
| Catalog | All 33 supported; exact seven Endgame; Weaver available but unchecked; Robot Dragon rejected; Suphara retained; empty unknown map; six regions with SA/NA defaults. |
| Merge | Older report delivered late, newer check same kill, manual correcting automatic both directions, automatic replacing manual, equal IDs/timestamps, repeated imports, skew, expiry, coherent killer fields. |
| Selection | Deselected local data hidden and expires; new deselected observations ignored; remote unselected rows preserved; filtered table does not constrain exports. |
| Capture | Existing spawn/fresh SyncType, malformed fields, retransmits, revisits, object reuse, context resets, aliases, missing region/channel, out-of-proximity silence not proof of spawn. |
| Capture lifecycle | Game absent/start/stop, missing Npcap/permissions, wrong adapter, stalled decode, protocol mismatch, restart/sleep, continued tray-hidden collection. |
| UI | Sort directions and numeric/time ordering, name/map/region/channel/killer search, scrollable choices, None selected, Add/Edit, fixed disabled timezone selector, 125–200% DPI, focus stability. |
| Tray/hotkeys | X/native Close/Alt+F4 hides; minimize taskbar; tray Show/Settings/Exit; start minimized; F7/F8/F9/rebind/disable/conflict/autorepeat; duplicate launch; Explorer restart; no orphan backend. |
| Persistence | Save/restart, atomic-write interruption, backup recovery, invalid schema/migration, read-only portable folder, disk full, next-day stale cleanup, cleared payloads not retained indefinitely in backups. |
| Text | Kill time rather than respawn time, 24-hour format, `UTC-3` headers, exact abbreviations, no uncertainty symbols, only selected Dark Fortress bosses, chronological midnight ordering, empty output. |
| JSON/compression | Killer retained, UTF-8 round trip, immutable gathered timestamps, no credentials, invalid base64/gzip/version/size/nesting/channels, decompression limit, rejected text import, cancel/no mutation. |
| Convex connection | Empty/invalid URL/key, wrong origin, missing functions/init, schema version, group-key checks in every public endpoint, key rotation, URL/key change during request, no credentials in exports/logs. |
| Attribution | Live local character vs inspected player; cached/manual fallback; no name holds uploads; switch during request; killer vs observer vs sender; imported provenance retained; duplicates do not churn submitter metadata. |
| Convex mutations | Indexed upserts preserve one slot; validation before commit, selected-only uploads preserve other slots, monotonic revisions, unchanged response without writes/full scan, full snapshot/delta recovery, physical expiry clearing. |
| Scheduler | All six intervals (10s/20s/30s/1m/2m/5m); no 10m option; default stopped; Start immediate sync; manual F9 during auto/active requests; at most one follow-up; live interval change while waiting/syncing/backoff; Stop prevents future retry; tray continuation; no restart/sleep backlog. |
| Concurrency | Two/many writers same/different slots, transactional latest-evidence merge, response loss/idempotent retry, local observations arriving mid-sync, watermark atomicity, key errors/quota/offline backoff. |
| Reset/cleanup | Confirmation, generation advance, simultaneous old sync rejected or cleared before reset, duplicate Reset cannot erase post-reset data, old JSON cutoff, delayed cleanup cannot clear newer cycle, unrelated tables untouched. |
| Logs | Meaningful failures/versions retained, warning throttling, byte/age caps, no raw packets/tokens/killer names/private URLs, disk failures do not stop capture. |
| Package | Correct x64 shell/Bun/assets/hotkey helper/version/DPI, no local state/secrets/research, missing-prerequisite guidance, clean-machine launch/Exit, portable upgrade. |

Local merge/search/export should be fast for 42 slots and the full 594-slot working set; benchmark with realistic and expanded fixtures. Measure database I/O and egress as well as function calls; mock tests do not prove provider quota behavior. Record live capture/Convex/clean-machine checks as pending until actually run.

## 11. Windows release routine

Adapt upstream's [release workflow](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/.github/workflows/release.yml) and [portable verifier](https://github.com/kar-mi/spirit-vale-overlay/blob/4f1f8000bbdb19f7234aa9e73ddb89106fe3d389/tooling/release/verify-portable.ts), trimming unrelated assets but retaining whichever native helper is actually needed for the approved hotkeys.

1. **Pin inputs:** Bun, TypeScript, shell/runtime dependencies, capture/catalog packages and lockfile; record upstream provenance and Windows runner image. Recheck compatibility before dependency bumps.
2. **CI on pushes/PRs:** clean checkout, frozen dependency install, typecheck, relevant tests, build, version/config consistency. Use public npm where available. Never commit registry tokens or expose release credentials to untrusted PR jobs.
3. **Manual dry run:** `workflow_dispatch` produces a test artifact without publishing. Assemble `mvp-tracker-windows-x64-vX.Y.Z.zip` with one matching versioned folder and clearly named executable.
4. **Bundle:** Windows x64 shell, Bun/backend/resources, required hotkey helper, icon/version/DPI metadata, README, license/attribution and corresponding-source/build instructions. Users need no Bun/Node/Git/package or Convex deployment credentials.
5. **Exclude:** developer credentials, `.git`, research clones, settings/timers/logs, Convex credentials or private deployment configuration, tokens, non-Windows binaries, unrelated tools/assets. Create fresh empty writable data directories at runtime if needed.
6. **Verify:** extract into a fresh directory; check layout/allowlist/runtime/version/DPI; smoke startup/Exit where CI supports it. Interactive tray/capture is a separate Windows check. Generate SHA-256 checksums and dependency/source manifest.
7. **Publish:** update app version/changelog, commit/push the release step, tag `app-vX.Y.Z`, validate tag/version agreement, run the same verified pipeline, publish unsigned ZIP/checksums/source material and release notes to `lfmnovaes/mvp-tracker`. Limit write permission to release jobs and avoid duplicate publication.
8. **Validate downloaded release:** clean Windows 11 x64 launch, prerequisites, persistent tray, manual/core flows, fixed timezone, logs, portable data and upgrade. Document unsigned Windows reputation prompts accurately.
9. **Upgrade/rollback:** back up current nonexpired data/settings before migration; restore/migrate explicitly when extracting a new version. Keep the last compatible release available. Correct published defects with a new patch version rather than silently replacing assets.

Npcap remains a separately installed prerequisite, with upstream's WinPcap-compatible installation guidance; Neutralino needs a compatible WebView2 runtime. Test and document these system prerequisites even though the application itself is portable. No bundled Npcap installer, code signing, Windows 10/ARM64 builds, Electron release, or application installer is required for version 1. No auto-update binary replacement is required.

CI must also check Convex generated API/schema compatibility and run the server test suite. Publishing a desktop release does not automatically run development deployment or Reset against the live group. Ship matching backend source/protocol version and owner update instructions; deploy compatible backend changes to the selected cloud dev deployment as a separate explicit step. Never include `.env.local`, the shared group key, or Convex deploy credentials in Windows artifacts or public CI output.

## 12. Far-future backlog

Keep these outside the current implementation scope:

- Convex production deployment, individual identity/roles, separate viewer/admin capabilities, and group-key management beyond the initial shared-key model.
- Optional realtime subscriptions if they improve traffic/UX over timed sync; retain clear user control of background activity.
- A read-only shared web view for people without the desktop application. Version 1 provides compact text sharing and owner inspection through Convex Dashboard instead of the removed spreadsheet view.
- User-selectable timezones and richer cross-zone UI; retain UTC data compatibility now.
- Portuguese/localization and sound/desktop spawn alerts. Timed automatic Convex sync is already in version 1.
- Launch with Windows, installer, signing, additional OS/architectures or Electron fallback, and richer update tooling if requested later.

Version 1 completion requires the accepted local features, all 33 supported boss choices with seven defaults, correct +150-minute cleanup, working portable tray/hotkeys, selected-scope clipboard exchange, shared-key Convex manual/automatic sync with character attribution and safe transactional reset, and verified Windows releases. Mocked functions or a URL-only form do not count as live database support. Owner setup documentation must distinguish cloud development deployment, code deployment, and data reset.
