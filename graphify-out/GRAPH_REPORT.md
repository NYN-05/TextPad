# Graph Report - TextPad  (2026-08-27)

## Corpus Check
- 114 files · ~53,320 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 833 nodes · 1549 edges · 64 communities (53 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 26 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Debug Tools & API Probing
- Context Menu & Dashboard UI
- App Shell & Routing
- Client Penetration Testing
- Client Dependencies
- Encryption & File Storage
- Server Health & CORS
- Settings & Crypto Key Management
- Sync Engine Core
- Server Sync Handlers
- Sync Engine Transport
- Client TypeScript Config
- Performance Debugging
- Benchmark Suite
- Sync Architecture Decisions
- Server Dependencies
- Landing Page UI
- Node TypeScript Config
- Upgrade Decision Log
- Server Sync Logic
- Client Pentest Utilities
- Pentest TypeScript Config
- Error Boundary UI
- Local File & Patch Worker
- Delta Sanitization & Patcher
- Server Database Layer
- Auth & Rate Limiting
- Server Sync Registration
- Security Architecture Decisions
- opencode Config
- API Design & Server Rules
- Delta Sanitize CJS Build
- Delta Sanitize JS Build
- Prototype Probing
- Smoke Security Testing
- Performance Architecture Decisions
- Live Penetration Testing
- Sync Transport Layer
- Security Audit Findings
- Encrypt CJS Build
- Encrypt JS Build
- Debug3 Probing
- Encrypt Core Functions
- Deployment Architecture
- Perf Debug Dev Tools
- Toast Notification UI
- Search Worker
- Perf Debug2 Tools
- Perf Debug3 Tools
- Vercel Config
- Sync Test Utilities
- Toolbar UI
- Vite Type Definitions
- Root TypeScript Config
- Performance Report Results
- CSP Report Endpoint
- Health Endpoint
- Data Flow Diagram
- Architecture Diagram

## God Nodes (most connected - your core abstractions)
1. `SyncEngine` - 33 edges
2. `AppInner()` - 27 edges
3. `createApi()` - 27 edges
4. `checkServerInvariants()` - 21 edges
5. `awaitFlush()` - 21 edges
6. `assert()` - 20 edges
7. `scenario()` - 20 edges
8. `main()` - 20 edges
9. `TextPad` - 18 edges
10. `tx()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `client/index.html Entry Point` --references--> `TextPad`  [EXTRACTED]
  client/index.html → AGENTS.md
- `better-sqlite3 (retained at 12.x)` --references--> `TextPad`  [EXTRACTED]
  DEPENDENCY_REPORT.md → AGENTS.md
- `Version Semantics` --references--> `SyncEngine`  [EXTRACTED]
  Docs/ARCHITECTURE.md → AGENTS.md
- `Encryption Layer Architecture` --references--> `AES-256-GCM Encryption`  [EXTRACTED]
  Docs/ARCHITECTURE.md → AGENTS.md
- `Malformed Delta Infinite-Loop Fix` --references--> `jsondiffpatch`  [EXTRACTED]
  PENTEST_REPORT.md → AGENTS.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Batched Delta Sync System** — textpad_sync_engine, textpad_jsondiffpatch, textpad_web_workers, textpad_enc_prefix, textpad_send_beacon, textpad_merge_text [EXTRACTED 1.00]
- **Defense-in-Depth Security Stack** — textpad_aes_256_gcm, textpad_csp, textpad_hmac_sha256, textpad_rate_limiting, docs_security_hsts, docs_security_key_wrapping [EXTRACTED 1.00]
- **Local-First Architecture Principles** — textpad_local_first_philosophy, textpad_server_minimalism, textpad_graceful_degradation, textpad_optimistic_updates, docs_privacy_zero_pii [EXTRACTED 1.00]

## Communities (64 total, 11 thin omitted)

### Community 0 - "Debug Tools & API Probing"
Cohesion: 0.20
Nodes (37): a, api, api2, srv, applyJsonPatch(), assert(), awaitFlush(), checkServerInvariants() (+29 more)

### Community 1 - "Context Menu & Dashboard UI"
Cohesion: 0.06
Nodes (32): Editor, ContextMenuItem, Props, ActivityDrawer(), activityIcon, Dashboard(), DashboardProps, formatBytes() (+24 more)

### Community 2 - "App Shell & Routing"
Cohesion: 0.08
Nodes (28): AppInner(), ViewState, ConfirmDialog(), ConfirmDialogProps, LoadingScreen(), NoFileSelected(), NoFileSelectedProps, NotFound() (+20 more)

### Community 3 - "Client Penetration Testing"
Cohesion: 0.06
Nodes (37): a, atkDel, atkList, atkPull, attacker, auth, authedReq(), authedSync() (+29 more)

### Community 4 - "Client Dependencies"
Cohesion: 0.06
Nodes (34): dependencies, jsondiffpatch, react, react-dom, dev:network, devDependencies, playwright, @types/react (+26 more)

### Community 5 - "Encryption & File Storage"
Cohesion: 0.14
Nodes (23): getCryptoKey(), generateUUID(), addFile(), addTombstone(), countFiles(), createFile(), decryptContent(), decryptFile() (+15 more)

### Community 6 - "Server Health & CORS"
Cohesion: 0.10
Nodes (20): createHealthHandler(), startTime, ALLOWED_ORIGINS, app, CSP_REPORT_KEYS, DEFAULT_ORIGINS, __dirname, requireAuth (+12 more)

### Community 7 - "Settings & Crypto Key Management"
Cohesion: 0.16
Nodes (12): Props, clearCryptoKey(), setCryptoKey(), setEncryptionEnabled(), Keychain, getKeyBlob(), storeKeyBlob(), AppSettings (+4 more)

### Community 8 - "Sync Engine Core"
Cohesion: 0.13
Nodes (15): dequeueOp(), enqueueOp(), EngineConfig, FlushResult, PulledContent, StorageQueue, AcceptedVersion, KeyBlob (+7 more)

### Community 9 - "Server Sync Handlers"
Cohesion: 0.10
Nodes (17): createSyncDeleteHandler(), createSyncPullHandler(), isValidFileId(), c0, CONTENT, counts, db, del (+9 more)

### Community 10 - "Sync Engine Transport"
Cohesion: 0.18
Nodes (5): getPendingOps(), getSyncCredentials(), storeSyncCredentials(), createPatchWorker(), SyncEngine

### Community 11 - "Client TypeScript Config"
Cohesion: 0.09
Nodes (21): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+13 more)

### Community 12 - "Performance Debugging"
Cohesion: 0.17
Nodes (15): dev, __dirname, gotoDashboard(), injectProbes(), landAndStart(), preview, results, ROOT (+7 more)

### Community 13 - "Benchmark Suite"
Cohesion: 0.18
Nodes (18): bytesBy, child, CONTENT, deleteFile(), __dirname, getHistory(), getList(), latencies (+10 more)

### Community 14 - "Sync Architecture Decisions"
Cohesion: 0.15
Nodes (15): Delta Sanitization (delta-sanitize.ts), better-sqlite3 (retained at 12.x), jsondiffpatch 0.7.6 Upgrade, Verification Matrix, DELETE /api/sync/:fileId Endpoint, GET /api/sync Endpoint, GET /api/sync/:fileId Endpoint, Sync Flow (enqueue/flush/pull) (+7 more)

### Community 15 - "Server Dependencies"
Cohesion: 0.13
Nodes (14): better-sqlite3, express, express-rate-limit, pino, dependencies, better-sqlite3, express, express-rate-limit (+6 more)

### Community 16 - "Landing Page UI"
Cohesion: 0.13
Nodes (6): FEATURES, LandingPage(), LandingPageProps, TECHS, TESTIMONIALS, WHY_CHOOSE

### Community 17 - "Node TypeScript Config"
Cohesion: 0.13
Nodes (14): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+6 more)

### Community 18 - "Upgrade Decision Log"
Cohesion: 0.14
Nodes (15): CORS Middleware Replacement, Express 5 Upgrade, React 19 Upgrade, Vite 7 Upgrade, HSTS Transport Security, React Doctor Accessibility Issues, React Doctor Bug Issues, React Doctor Maintainability Issues (+7 more)

### Community 19 - "Server Sync Logic"
Cohesion: 0.21
Nodes (13): clampTimestamp(), createSyncHandler(), fileBytes(), newestSnapshotVersion(), pruneHistory(), auth, makeRes(), over (+5 more)

### Community 20 - "Client Pentest Utilities"
Cohesion: 0.14
Nodes (6): here, { Patcher }, payloadTexts, probePath, require, { sanitizeDelta }

### Community 21 - "Pentest TypeScript Config"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, module, moduleResolution, outDir, rootDir, skipLibCheck, strict (+5 more)

### Community 22 - "Error Boundary UI"
Cohesion: 0.15
Nodes (5): ErrorBoundary, Props, State, perfEnabled, PerfStats

### Community 23 - "Local File & Patch Worker"
Cohesion: 0.22
Nodes (3): LocalFile, updateFile(), PatchWorker

### Community 24 - "Delta Sanitization & Patcher"
Cohesion: 0.19
Nodes (5): FORBIDDEN_KEYS, sanitizeDelta(), Patcher, WorkerMessage, WorkerResponse

### Community 25 - "Server Database Layer"
Cohesion: 0.20
Nodes (8): columnExists(), DATA_DIR, DB_PATH, __dirname, getDatabase(), createStore(), fileBytes(), key()

### Community 26 - "Auth & Rate Limiting"
Cohesion: 0.27
Nodes (8): LIMITS, createAuthMiddleware(), extractCredentials(), signToken(), TOKEN_TTL_MS, verifyToken(), OP_TYPES, ValidationError

### Community 27 - "Server Sync Registration"
Cohesion: 0.17
Nodes (10): createRegisterHandler(), createSyncListHandler(), l, list, r1, r2, reg, s (+2 more)

### Community 28 - "Security Architecture Decisions"
Cohesion: 0.17
Nodes (12): PBKDF2 600k Iterations Upgrade, End-to-End Encryption Policy, Zero PII Collection, Security Architecture, Group Key Derivation (SHA-256), AES-KW + PBKDF2 Key Wrapping, Known Security Constraints, AES-256-GCM Encryption (+4 more)

### Community 29 - "opencode Config"
Cohesion: 0.17
Nodes (11): del *, git *, node *, npm install*, npm run *, npm uninstall*, Remove-Item*, rm * (+3 more)

### Community 30 - "API Design & Server Rules"
Cohesion: 0.18
Nodes (11): Token Expiry Enforcement, Server-side Op Processing Rules, POST /api/sync/register Endpoint, POST /api/sync Endpoint, Encryption Layer Architecture, Server Middleware Stack, Version Semantics, XFF Rate-Limit Spoofing (Residual) (+3 more)

### Community 31 - "Delta Sanitize CJS Build"
Cohesion: 0.20
Nodes (4): FORBIDDEN_KEYS, delta_sanitize_1, jsondiffpatch_1, Patcher

### Community 32 - "Delta Sanitize JS Build"
Cohesion: 0.20
Nodes (4): FORBIDDEN_KEYS, delta_sanitize_1, jsondiffpatch_1, Patcher

### Community 33 - "Prototype Probing"
Cohesion: 0.18
Nodes (7): base, delta, here, [mode, baseJson, deltaJson], { Patcher }, require, { sanitizeDelta }

### Community 34 - "Smoke Security Testing"
Cohesion: 0.20
Nodes (9): validateSyncBody(), f, protoOp, r, reg, s, store, sync (+1 more)

### Community 35 - "Performance Architecture Decisions"
Cohesion: 0.22
Nodes (10): Request Minimization, Deployment Decision Log, Bundle Size Budget, Incremental Flush Optimization, Batched Delta Sync, IndexedDB v4, Lazy Loading, navigator.sendBeacon Flush (+2 more)

### Community 36 - "Live Penetration Testing"
Cohesion: 0.22
Nodes (6): any429, AUTH, regBody, results, spoofed, t0

### Community 38 - "Security Audit Findings"
Cohesion: 0.29
Nodes (7): Security Audit Findings, Audit Fixes Applied, Client 16/16 Checks Passed, Malformed Delta Infinite-Loop Fix, Penetration Test Report, Residual Security Risks, Server 60/60 Checks Passed

### Community 39 - "Encrypt CJS Build"
Cohesion: 0.38
Nodes (3): arrayBufferToBase64(), base64ToArrayBuffer(), Encrypt

### Community 40 - "Encrypt JS Build"
Cohesion: 0.38
Nodes (3): arrayBufferToBase64(), base64ToArrayBuffer(), Encrypt

### Community 41 - "Debug3 Probing"
Cohesion: 0.29
Nodes (6): clientRequire, d, { diff, patch }, __dirname, r, t0

### Community 42 - "Encrypt Core Functions"
Cohesion: 0.33
Nodes (3): arrayBufferToBase64(), base64ToArrayBuffer(), Encrypt

### Community 43 - "Deployment Architecture"
Cohesion: 0.40
Nodes (5): client/index.html Entry Point, Render Deployment, Vercel Deployment, Monorepo Layout, Render Blueprint Config

### Community 45 - "Toast Notification UI"
Cohesion: 0.40
Nodes (3): ToastItem, ToastMessage, ToastType

### Community 46 - "Search Worker"
Cohesion: 0.40
Nodes (3): corpus, CorpusFile, SearchMatch

### Community 49 - "Vercel Config"
Cohesion: 0.50
Nodes (3): headers, rewrites, $schema

### Community 50 - "Sync Test Utilities"
Cohesion: 0.67
Nodes (3): awaitFlush(), __dirname, s08()

### Community 55 - "Performance Report Results"
Cohesion: 0.67
Nodes (3): Performance Report, Server Throughput +22%, Sync Batch p50 -41%

## Knowledge Gaps
- **291 isolated node(s):** `name`, `private`, `type`, `dev`, `build` (+286 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `SyncEngine` connect `Sync Engine Transport` to `App Shell & Routing`, `Encryption & File Storage`, `Sync Transport Layer`, `Sync Engine Core`, `Local File & Patch Worker`, `Delta Sanitization & Patcher`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `createStore()` connect `Server Database Layer` to `Debug Tools & API Probing`, `Smoke Security Testing`, `Client Penetration Testing`, `Server Health & CORS`, `Server Sync Handlers`, `Server Sync Logic`, `Server Sync Registration`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `TextPad` connect `Upgrade Decision Log` to `Deployment Architecture`, `Sync Architecture Decisions`, `Performance Report Results`, `Security Architecture Decisions`, `API Design & Server Rules`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `AppInner()` (e.g. with `.init()` and `.pull()`) actually correct?**
  _`AppInner()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `name`, `private`, `type` to the rest of the system?**
  _291 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Context Menu & Dashboard UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06274509803921569 - nodes in this community are weakly interconnected._
- **Should `App Shell & Routing` be split into smaller, more focused modules?**
  _Cohesion score 0.08292682926829269 - nodes in this community are weakly interconnected._