# Diagnostics

## Ordinary errors

Settings → Diagnostics provides **Copy diagnostics**, **Open logs** and **Clear logs**. Essential logs rotate with bounded size; capture/IPC/storage/sync failures include context. Monitor all starts off and is never enabled by restoring settings. Timers and recording payloads are not uploaded with sync diagnostics.

## Missing gravestone evidence

1. Start the game and select the correct network adapter if automatic capture chose incorrectly.
2. Settings → Diagnostics → **Start monitor all**.
3. Change channel and approach a known gravestone. Note the boss, region/channel and approximate encounter time.
4. **Stop recording**. Stop only saves the raw folder; no ZIP is created yet.
5. **Optimize all recordings**. This processes stopped sessions, retaining flows attributed to Spirit Vale and capture/process/health context. Each success becomes a `_clean` folder and its own `_clean.zip`.
6. Open recordings, review the ZIP and attach it with copied diagnostics to a [GitHub issue](https://github.com/lfmnovaes/mvp-tracker/issues).

Raw sessions contain TCP/UDP traffic from other applications on the selected adapter. Optimization removes unrelated traffic, but game/player/network details remain. Nothing uploads automatically. Recordings stop after ten minutes or 128 MiB.

The active session is always skipped. Existing corresponding ZIPs are skipped. Already-clean folders are not filtered twice; a missing ZIP is retried. Unidentifiable/corrupt sessions and failed ZIPs preserve the original recording and report the reason. Older unsuffixed ZIPs may contain raw traffic; only `_clean.zip` indicates optimized output.

**Clear recordings** confirms before deleting stopped recording folders and ZIPs; the current session is preserved. **Clear logs** affects essential logs separately.

## Offline analysis and protocol maintenance

```powershell
bun run analyze:recording -- "C:\path\to\monitor-session_clean"
python scripts/inspect-game-rpcs.py --help
```

Analysis accepts an extracted recording folder and reports transport/protocol/context counts. The optional Python inspector requires capstone 5.0.6 in an isolated environment and an offline Il2CppDumper dump. Reproducing protocol changes requires the user's installed public-game build; publictest evidence is excluded. [Local capture module](../src/spiritvale/README.md) documents the current profile. Do not guess new RPC IDs or silently fall back to historical layouts.
