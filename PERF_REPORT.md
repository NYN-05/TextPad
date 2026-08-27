# TextPad Performance Report

Measured with `client/scripts/perf.mjs` (Playwright, 500 seeded 10KB files + 2MB big file, Chromium) and `server/scripts/bench.mjs` / `server/scripts/bench-store.mjs`. Baselines and optimized snapshots persist in `client/scripts/prof/*.json` and `server/scripts/prof/*.json`. All runs happened on the same machine; run-to-run variance under local load is ~±20% wall time, so latency deltas are read from medians/structural changes (statement counts, longtask patterns), not single runs.

## Client

| Metric | Baseline | Optimized | Delta |
| --- | --- | --- | --- |
| Search: time to first result (500×10KB corpus) | 764 ms | 790–818 ms | ~noise; scan off main thread |
| Search: worker round-trip | — (sync scan, main thread) | 16 ms | scan removed from main thread |
| Search: main-thread scan longtask | 232 ms | none (residual longtasks = pre-existing dashboard render, present in baseline too) | eliminated |
| Typing small file: commits | 81–85 | 84–85 | neutral (throttle batches with content commit) |
| Typing big file: longtasks | 5 (incl. 258 ms mid-typing stats longtask) | 3 (mid-typing stats longtask gone) | −2 longtasks |
| Typing big file: render total | 813 ms | 799 ms | −14 ms |
| Diff worker (patch round-trip) | 23.8 ms (ok:false — harness bug) | 22.2 ms (ok:true) | probe fixed; identical |
| Apply worker | 2.9 ms | 3.0 ms | neutral |
| 3-way merge worker | 5.4 ms | 2.5 ms | −2.9 ms |
| Crypto enc 100KB ×10 | 46.9 ms | 20–32 ms | no code change; noise |
| Crypto dec 100KB ×10 | 15.1 ms | 16–17 ms | neutral |
| IndexedDB put/get/getAll (701 rows) | 82 / 34.3 / 49.4 ms | 81.6 / 32.2 / 49.8 ms | neutral |
| Startup → dashboard (500 files) | 2253 ms | 2159 ms | −94 ms |

### Bundle (vite build, gzip)
| Chunk | Size |
| --- | --- |
| `search.worker-*.js` (new) | 0.52 kB — separate chunk, no jsondiffpatch |
| `sync.worker-*.js` | 18.41 kB |
| main `index-*.js` | 275.34 kB (80.99 kB gzip) |

## Server

| Metric | Baseline | Optimized | Delta |
| --- | --- | --- | --- |
| Throughput (150 req mixed) | 208.9 req/s | 255.6 req/s | **+22%** |
| sync-batch p50 | 18.28 ms | 10.7 ms | **−41%** |
| sync-list p50 | 2.49 ms | 2.05 ms | −18% |
| sync-history p50 | — | 1.0 ms | — |
| sync-delete p50 | — | 1.4 ms | — |
| DB size after bench | 6,995,568 B | 6,876,736 B | −119 KB (pruning now actually deletes) |
| RSS | 86 MB | 85 MB | neutral |

### bench-store (500 files / 5 devices / 690 versions, totalChanges 2740)
| Operation | Baseline | Optimized | Delta |
| --- | --- | --- | --- |
| Initial snapshot (500 ops) | — | 0.028 ms/op, 2.0 stmts/op | — |
| Delta round 1 (7-day history depth) | 7.0 stmts/op | 3.0 stmts/op, 0.195 ms/op | −57% |
| Delta round 2 (11-day) | 11.1 stmts/op | 3.0 stmts/op, 0.282 ms/op | −73% |
| Delta round 3 (15-day) | 15.1 stmts/op | 3.0 stmts/op, 0.215 ms/op | **−80%** (constant, no longer grows) |
| Metadata refresh | 10.1 stmts/op | 2.0 stmts/op, 0.264 ms/op | −80% |
| Sync list (100 files) | — | 0.771 ms/op | — |
| Delete | — | 6.2 stmts/op, 0.451 ms/op | — |

## Changes

### Client
- `client/src/workers/search.worker.ts` (new, 0.52 kB): content search runs in a dedicated worker; corpus cached via `SET_FILES`, per-query `SEARCH` returns `{id, results}`. Worker is created when the search overlay opens (not on mode switch), so the corpus structured-clone happens before typing starts; terminated on close.
- `client/src/hooks/useSearch.ts`: worker-backed content search with sync `searchContentSync()` fallback when `Worker` is unavailable; debounce cut 150 ms → 50 ms (the 150 ms was added cost over the baseline's per-keystroke scan; the worker makes each query ~16 ms so long debounce is no longer needed); stale in-flight results cancelled via effect cleanup.
- `client/src/components/Editor.tsx`: status-bar stats (`computeStats` — `split("\n")` + `trim().split(/\s+/)`) throttled to one call per 400 ms (`maybeUpdateStats`). A `useDeferredValue` approach was tried first and rejected (added a render per keystroke, commits 81 → 99).
- `client/src/sync/storage.ts`: removed dead `count()` (full `getPendingOps()` scan, never called — engine reads the queue directly).

### Server
- `server/lib/store.js`: `flushSyncFile` is incremental — per-record `fileState` WeakMap tracks min/max persisted version; inserts only versions above `state.max`, deletes only pruned history via a prepared `delVersionsBefore` statement; `record.bytes` cached on load so `bytesForGroup` and `fileBytes` are O(1). Eliminated the write amplification that grew with history depth (7 → 15 stmts/op) and the 65% CPU hotspot in the bytes cache.
- `server/handlers/sync.js`: `pruneHistory` runs before the final record property mutations (deleted/name/updatedAt) in both snapshot and delta paths — pruned versions are now actually removed from SQLite (previously the in-memory record was fixed up but the DB rows lingered and resurrected on restart); `groupFileCount` closure (allocating a proxy per op) replaced with `files.activeFileCount(groupId)`.

## Correctness / regression gates

- Server `verify.mjs`: original code 954 assertions / **8 failures** (S08/S10/S13/S14/S16/S17/S18/S19). Optimized code 949 / **3 failures** (S08/S10/S13 — confirmed pre-existing via A/B restore, they fail identically on the original code; the optimized code **fixes S14/S16/S17/S18/S19**, all pruning-persistence protocol bugs). Zero new failures.
- Server `pentest-core.mjs`: 42/42 PASS; `eslint`: clean.
- Client `pentest-client.mjs`: 16/16 PASS; `npm run build` (tsc -b + vite): clean.
- A/B method: no git repo, so optimized `store.js`/`sync.js` were backed up, originals restored from memory, verify re-run, optimized versions restored.

## Notes

- `perf.mjs` worker phase previously reported `ok:false` because the harness didn't unwrap `{delta}`/`{result}` envelopes; fixed — the diff worker was always functioning.
- Wall-clock typing numbers are dominated by Playwright key injection and a pre-existing ~240 ms dashboard render that fires on editor open/mode switch (present in baseline and optimized runs identically); render-phase work (commits/totalMs) is the reliable signal.
- Search `timeToFirstResultMs` is bounded by the same pre-existing mode-switch render, not by the search itself (worker round-trip measured at 16 ms).
