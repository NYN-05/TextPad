# Graph Report - TextPad  (2026-09-23)

## Corpus Check
- Corpus is ~49,935 words - fits in a single context window. You may not need a graph.

## Summary
- 775 nodes · 1548 edges · 52 communities (37 shown, 13 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Community 1
- Community 2
- Community 3
- Community 4
- Community 5
- Community 6
- Community 7
- Community 8
- Community 9
- Community 10
- Community 11
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50

## God Nodes (most connected - your core abstractions)
1. `ClientSim` - 35 edges
2. `SyncEngine` - 34 edges
3. `AppInner()` - 28 edges
4. `createApi()` - 27 edges
5. `react` - 26 edges
6. `checkServerInvariants()` - 21 edges
7. `awaitFlush()` - 21 edges
8. `assert()` - 20 edges
9. `scenario()` - 20 edges
10. `main()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `IndexedDB v4 (textpad)` --semantically_similar_to--> `IndexedDB v4 Schema (files, sync_queue, keychain, sync_meta)`  [INFERRED] [semantically similar]
  AGENTS.md → Docs/ARCHITECTURE.md
- `SyncEngine (Batched Delta Sync)` --semantically_similar_to--> `SyncEngine (enqueue/flush/pull/beacon)`  [INFERRED] [semantically similar]
  AGENTS.md → Docs/ARCHITECTURE.md
- `AES-256-GCM Encryption` --semantically_similar_to--> `Encryption Layer (AES-256-GCM, Graceful Degradation)`  [INFERRED] [semantically similar]
  AGENTS.md → Docs/ARCHITECTURE.md
- `HMAC-SHA256 Authentication` --semantically_similar_to--> `POST /api/sync/register (Device Registration)`  [INFERRED] [semantically similar]
  AGENTS.md → Docs/API.md
- `navigator.sendBeacon Flush` --references--> `client/src/App.tsx (Central Orchestrator)`  [INFERRED]
  AGENTS.md → Docs/ARCHITECTURE.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Sync API Endpoints** — docs_api_register, docs_api_sync_post, docs_api_sync_get, docs_api_sync_pull, docs_api_sync_delete [EXTRACTED 1.00]
- **Sync Pipeline** — arch_sync_engine, arch_delta_sync, arch_web_worker, docs_api_sync_post, docs_api_version_semantics, agents_sendbeacon [INFERRED 0.85]
- **Encryption Stack** — agents_encryption, agents_enc_prefix, arch_encryption_layer, arch_keychain, arch_basecontent [INFERRED 0.90]
- **Local-First Architecture Stack** — agents_local_first, agents_client_primary, agents_server_minimal, agents_indexeddb, agents_encryption, agents_sync_engine [INFERRED 0.90]

## Communities (52 total, 13 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (55): AppInner(), clearCryptoKey(), getCryptoKey(), arrayBufferToBase64(), base64ToArrayBuffer(), Encrypt, addFile(), addTombstone() (+47 more)

### Community 1 - "Community 1"
Cohesion: 0.21
Nodes (37): a, api, api2, srv, applyJsonPatch(), assert(), awaitFlush(), checkServerInvariants() (+29 more)

### Community 2 - "Community 2"
Cohesion: 0.05
Nodes (21): FORBIDDEN_KEYS, FORBIDDEN_KEYS, delta_sanitize_1, jsondiffpatch_1, Patcher, delta_sanitize_1, jsondiffpatch_1, Patcher (+13 more)

### Community 3 - "Community 3"
Cohesion: 0.06
Nodes (34): better-sqlite3, express, express-rate-limit, pino, createHealthHandler(), startTime, ALLOWED_ORIGINS, app (+26 more)

### Community 4 - "Community 4"
Cohesion: 0.06
Nodes (37): a, atkDel, atkList, atkPull, attacker, auth, authedReq(), authedSync() (+29 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (31): dependencies, jsondiffpatch, react, react-dom, dev:network, devDependencies, playwright, @types/react (+23 more)

### Community 6 - "Community 6"
Cohesion: 0.08
Nodes (22): dev, p, dev, p, dev, p, dev, __dirname (+14 more)

### Community 7 - "Community 7"
Cohesion: 0.07
Nodes (34): 500ms Debounced Autosave, Client as Primary Execution Environment, ~enc~ Prefix Protocol, AES-256-GCM Encryption, Engineering Rules (43 sections), Golden Rule (Decision Hierarchy), HMAC-SHA256 Authentication, IndexedDB v4 (textpad) (+26 more)

### Community 8 - "Community 8"
Cohesion: 0.09
Nodes (20): ViewState, ConfirmDialog(), ConfirmDialogProps, LoadingScreen(), NoFileSelected(), NoFileSelectedProps, NotFound(), NotFoundProps (+12 more)

### Community 9 - "Community 9"
Cohesion: 0.10
Nodes (17): createSyncDeleteHandler(), createSyncPullHandler(), isValidFileId(), c0, CONTENT, counts, db, del (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.18
Nodes (18): bytesBy, child, CONTENT, deleteFile(), __dirname, getHistory(), getList(), latencies (+10 more)

### Community 11 - "Community 11"
Cohesion: 0.16
Nodes (10): Editor, Props, Props, Props, useActiveFile(), SyncStatus, useUI(), FileData (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.16
Nodes (14): ActivityDrawer(), activityIcon, Dashboard(), DashboardProps, formatBytes(), formatDate(), RecentFilesSection(), SystemStatus() (+6 more)

### Community 13 - "Community 13"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+8 more)

### Community 14 - "Community 14"
Cohesion: 0.13
Nodes (6): FEATURES, LandingPage(), LandingPageProps, TECHS, TESTIMONIALS, WHY_CHOOSE

### Community 15 - "Community 15"
Cohesion: 0.14
Nodes (6): here, { Patcher }, payloadTexts, probePath, require, { sanitizeDelta }

### Community 16 - "Community 16"
Cohesion: 0.15
Nodes (5): ErrorBoundary, Props, State, perfEnabled, PerfStats

### Community 17 - "Community 17"
Cohesion: 0.24
Nodes (8): Props, Props, createSearchWorker(), searchContentSync(), SearchMatch, SearchWorker, useSearch(), FileMeta

### Community 18 - "Community 18"
Cohesion: 0.26
Nodes (9): createRegisterHandler(), LIMITS, createAuthMiddleware(), extractCredentials(), signToken(), TOKEN_TTL_MS, verifyToken(), OP_TYPES (+1 more)

### Community 19 - "Community 19"
Cohesion: 0.20
Nodes (8): columnExists(), DATA_DIR, DB_PATH, __dirname, getDatabase(), createStore(), fileBytes(), key()

### Community 20 - "Community 20"
Cohesion: 0.15
Nodes (12): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+4 more)

### Community 21 - "Community 21"
Cohesion: 0.18
Nodes (9): createSyncListHandler(), l, list, r1, r2, reg, s, store (+1 more)

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (10): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.20
Nodes (9): validateSyncBody(), f, protoOp, r, reg, s, store, sync (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.27
Nodes (5): ContextMenuItem, Props, emptyArr, FileRow, fileIcon()

### Community 25 - "Community 25"
Cohesion: 0.31
Nodes (7): Props, setEncryptionEnabled(), AppSettings, DEFAULTS, loadSettings(), saveSettings(), useSettings()

### Community 27 - "Community 27"
Cohesion: 0.31
Nodes (8): auth, makeRes(), over, r, reg, req(), store, sync

### Community 28 - "Community 28"
Cohesion: 0.22
Nodes (6): any429, AUTH, regBody, results, spoofed, t0

### Community 30 - "Community 30"
Cohesion: 0.38
Nodes (3): arrayBufferToBase64(), base64ToArrayBuffer(), Encrypt

### Community 31 - "Community 31"
Cohesion: 0.38
Nodes (3): arrayBufferToBase64(), base64ToArrayBuffer(), Encrypt

### Community 32 - "Community 32"
Cohesion: 0.29
Nodes (6): clientRequire, d, { diff, patch }, __dirname, r, t0

### Community 33 - "Community 33"
Cohesion: 0.33
Nodes (4): showToast(), ToastItem, ToastMessage, ToastType

### Community 34 - "Community 34"
Cohesion: 0.60
Nodes (5): clampTimestamp(), createSyncHandler(), fileBytes(), newestSnapshotVersion(), pruneHistory()

### Community 35 - "Community 35"
Cohesion: 0.70
Nodes (3): generateUUID(), load(), useActivityLog()

### Community 36 - "Community 36"
Cohesion: 0.40
Nodes (3): corpus, CorpusFile, SearchMatch

### Community 37 - "Community 37"
Cohesion: 0.50
Nodes (3): headers, rewrites, $schema

### Community 38 - "Community 38"
Cohesion: 0.67
Nodes (3): awaitFlush(), __dirname, s08()

## Knowledge Gaps
- **274 isolated node(s):** `name`, `private`, `type`, `dev`, `build` (+269 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 361 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Community 11` to `Community 0`, `Community 33`, `Community 35`, `Community 5`, `Community 8`, `Community 12`, `Community 14`, `Community 16`, `Community 17`, `Community 24`, `Community 25`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `jsondiffpatch` connect `Community 2` to `Community 5`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Why does `playwright` connect `Community 6` to `Community 5`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `AppInner()` (e.g. with `.pull()` and `.setOnFilesUpdated()`) actually correct?**
  _`AppInner()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _274 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.056493884682585906 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.0467687074829932 - nodes in this community are weakly interconnected._