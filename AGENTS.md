# TextPad — Agent Instructions

## About this project

TextPad is a **local-first text editor**. The browser (client) is the primary execution environment: documents live in IndexedDB, all editing, diffing, compression, encryption, search, and validation happen client-side. The server exists only as a lightweight synchronization and backup layer and is never required for the app to function. Every design decision, rule, and change must reinforce this architecture: **maximum client-side execution, minimal server responsibility.**

## Commands

- **`npm run build`** (client/) — `tsc -b && vite build` (strict: both must pass)
- **`npm run server`** — `node index.js` in server/ (no build step, raw ESM, port 3001)
- **`npm run client`** — `npx vite --port 5173` in client/ (proxies `/api` → `localhost:3001`)
- **`npm run dev`** — not available; start client & server separately in two terminals
- Server has eslint (`server/eslint.config.js`), client has none.
- No tests exist.

## Monorepo layout

```
root/          — no package.json (AGENTS.md + Docs/); NOT deployed as a whole
client/        — Vite 6 + React 18 + TypeScript (tsc -b + vite build); vercel.json + .gitignore (own deploy root → Vercel)
server/        — Express 4 ESM, no build step (node index.js); render.yaml + .gitignore (own deploy root → Render)
```

- Install separately: `cd server && npm install && cd ../client && npm install`
- Deployment targets: client/ → Vercel (static), server/ → Render — each pushed as its own repo (see Docs/DEPLOYMENT.md)

## Client architecture

- **Entry**: `client/src/main.tsx` — renders `<App>` inside `<ErrorBoundary>`, warns if Web Crypto unavailable
- **No router**: sidebar-driven view switching via `view` state variable in `App.tsx` ("landing" | "loading" | "dashboard" | "editor" | "notfound")
- **No global state library**: all state managed via custom hooks in `client/src/hooks/` (10 hooks)
- **State**: `useFileStore` is the single source of truth — holds `LocalFile[]` (full data including content). `useFileList.ts` deleted.
- **Editor lazy-loaded**: `React.lazy(() => import("./components/Editor"))` with manual chunk `editor` in vite config
- **Service Worker**: `vite-plugin-pwa` with `injectManifest` strategy (`client/src/sw.ts`); Workbox `precacheAndRoute` + custom `fetch` handler (network-first for API + navigation, cache-first for assets)

## Sync (consolidated, batched delta sync)

- Single `SyncEngine` class in `client/src/sync/engine.ts` with helper files `transport.ts`, `storage.ts`, `patcher.ts`
- **Lazy-loaded**: engine is a dynamic import (`client/src/sync/engine.ts`, separate chunk); jsondiffpatch lives only in the engine + worker chunks, NOT the main bundle
- Methods: `init()` (reuses persisted credentials or registers once per browser), `syncAll()`, `enqueue(file)`, `flush()` (batched ≤100 ops, 3s debounce, retries, stale-version → rebase via 3-way `mergeText()`), `pull()` (staleness-cached 5 min, per-file versioned patches), `flushBeacon()` (sendBeacon), `deleteFile()`
- Init + registration happens once in `App.tsx` effect (only when `settings.cloudSync` is on AND view !== "landing")
- **Encrypted patches**: every op payload is `encryptContent()` (AES-256-GCM, `~enc~` prefix) — full content for `base` ops, encrypted jsondiffpatch delta otherwise; server stores opaque blobs
- Legacy `sync.ts` deleted; no legacy CRUD — sync API only

## Storage

- **Client**: IndexedDB v4, database `"textpad"`, 4 stores: `files` (keyPath: `id`, holds content + `baseContent` diff baseline), `sync_queue` (autoIncrement: true, pending ops), `keychain` (keyPath: `key`, holds keys + persisted `sync-credentials`), `sync_meta` (keyPath: `key`, sync metadata)
- **Server**: `better-sqlite3` (WAL mode) in `server/data/textpad.db` with 4 tables: `devices`, `files`, `file_versions`, `device_files`. Content is stored ONLY as opaque encrypted blobs — no `.txt` files, no plaintext. In-memory `Map` cache in `store.js` wraps SQLite via `Proxy` objects that flush to disk on mutation.

## Encryption

- AES-256-GCM via Web Crypto API (`globalThis.crypto.subtle`). Lazy-imported `Encrypt` class in `client/src/crypto/encrypt.ts`.
- **Graceful degradation**: if `crypto.subtle` unavailable, content stored as cleartext; check in `main.tsx:7`
- Encrypted content prefixed with `~enc~` in `client/src/db.ts` (`encryptContent`/`decryptContent`)
- Key passed through module-level variable (`crypto/crypto-init.ts`), not persisted in IndexedDB by default
- Sync patches encrypted client-side — the server never sees plaintext content or deltas

## Autosave

- 500ms debounce (default in `useAutosave`), then `engineRef.current.enqueue(f)` after every debounced save (only when cloud sync enabled)
- Also flushes + syncs on editor blur (`handleEditorBlur` in `App.tsx:280`); `beforeunload` → `flushBeacon()`

## Server endpoints

| Endpoint               | Method | Rate limit             | Notes                                                |
| ---------------------- | ------ | ---------------------- | ---------------------------------------------------- |
| `/api/sync/register` | POST   | 5/hr (skips localhost) | HMAC-SHA256 session token                            |
| `/api/sync`          | POST   | 120/min                | Batched delta sync — encrypted patches only         |
| `/api/sync`          | GET    | 120/min                | Device file metadata (no content), private cache 30s |
| `/api/sync/:fileId`  | GET    | 120/min                | Version history`?since=N` (opaque blobs)           |
| `/api/sync/:fileId`  | DELETE | 120/min                | Delete file + history (204)                          |
| `/api/health`        | GET    | —                     | Device/file counts                                   |
| `/api/csp-report`    | POST   | —                     | CSP violation log                                    |

Auth via `X-Device-Id` + `Authorization: Bearer` headers (body credentials accepted only on `POST /api/sync` for sendBeacon).
Rate limiters (`server/middleware/rateLimit.js`) all skip localhost.

## Auth & limits

- HMAC-SHA256 tokens (`server/middleware/auth.js`). No user accounts.
- `API_SECRET` env var auto-generated if unset (logged at startup). Set a FIXED value in production — generated secrets invalidate all tokens on restart.
- `CORS_ORIGINS` env (comma-separated) extends the default localhost origins; client base URL comes from `VITE_API_URL` (client build env; unset → Vite dev proxy).
- Limits (`server/lib/limits.js`): 1000 files/device, 50 versions/file, 100 ops/request, max name length 128, max patch size 1.5MB

## Conventions

- **Imports**: Client uses TS extensionless imports (`"./db"`), server uses `.js` extensions (`"./store.js"` — mandatory ESM)
- **CSS**: Plain `.css` files per component in `client/src/styles/`. No Tailwind, no CSS-in-JS, no shadcn.
- **TypeScript**: strict mode, `noUnusedLocals`/`noUnusedParameters` disabled
- **No code comments** — the codebase avoids inline comments. Don't add them.
- Server uses pino for logging (`server/lib/logger.js`), not `console.log` (except in startup/auth code)

## Other

- `updateFile()` in `db.ts:122` reads-then-writes (get + Object.assign + put) inside a single transaction
- `deleteFile()` in `db.ts:143` returns `void` (wraps `IDBRequest` with `.then(() => undefined)`)
- CSP is strict (`default-src 'self'`) — no inline scripts, no external CDN fonts
- More detailed docs in `Docs/` (API.md, ARCHITECTURE.md, CONTRIBUTING.md, DEPLOYMENT.md, FILE_MAP.md, PRIVACY.md, SECURITY.md)
- No `.gitignore` at root; no git repo initialized — `client/` and `server/` each carry their own `.gitignore` for their separate deploy repos

## Engineering Rules (always apply to every change)

### 1. Local-first philosophy

- **1.1** Solve problems, not write code. Before implementing, check whether the language, framework, stdlib, libraries, or platform already solves it.
- **1.2** Code is a liability — every function/class/module must justify its existence with measurable value.
- **1.3** Optimize for long-term maintainability: readability, simplicity, predictability over cleverness.
- **1.4** The browser is the primary execution environment. TextPad is local-first: documents live and work in the browser (IndexedDB); the server is only a sync/backup layer. Any computation that can run client-side MUST run client-side — editing, diffing, compression, encryption, search, filtering, validation, indexing, rendering.
- **1.5** Server minimalism: never move application logic server-side. The server coordinates synchronization, authentication, encrypted storage, and conflict resolution — nothing more. It must never own business rules, document processing, or plaintext content.
- **1.6** Offline-first: the app must remain fully functional with no network. Connectivity is an enhancement, never a requirement. Every feature must define its behavior for offline, degraded-network, and server-unreachable states.

### 2. Write minimum code

- **2.1** Never reinvent existing solutions (dates, auth, validation, logging, state, ORM, HTTP clients, serialization, image processing, crypto, math — use mature libraries).
- **2.2** Prefer built-in language features (list comprehensions, map/filter/reduce, generics, optional chaining, null coalescing, destructuring, async/await, stdlib collections).
- **2.3** Delete more code than you write: remove duplicates, dead code, unused vars, obsolete config; merge similar functions; simplify conditionals; reduce nesting.

### 3. Library-first — native browser APIs first

- **3.1** Search before implementing: native browser API → framework capability → trusted library → official SDK → external service → existing project code → custom code.
- **3.2** Prefer mature libraries (active maintenance, docs, adoption, security updates, semver, tests, stable APIs).
- **3.3** Never reimplement stdlib: sorting, searching, hashing, JSON parsing, HTTP, string manipulation, compression, crypto, collections, concurrency.
- **3.4** Use the browser platform before adding JavaScript: `crypto.subtle`, IndexedDB, `navigator.sendBeacon`, Cache Storage, Service Worker, Web Worker, `requestIdleCallback`, `structuredClone`, `TextEncoder`/`TextDecoder`, `Intl`, `URL`, `AbortController`, `navigator.storage`. A dependency that only replaces a few lines of straightforward native code is not justified.
- **3.5** Verify browser support before adoption; never silently rely on APIs behind feature flags (e.g. `crypto.subtle` requires secure context) without a degradation path.

### 4. Simplicity

- **4.1** Simplicity beats cleverness.
- **4.2** One function, one responsibility.
- **4.3** Keep functions small: one purpose, limited branching, few params, obvious return.

### 5. Browser performance engineering

- **5.1** Optimize algorithms before micro-optimizations (prefer O(log n)/O(n), avoid O(n²)/O(n³)).
- **5.2** Avoid repeated computation — cache/memoize/reuse.
- **5.3** Reduce memory allocations; reuse objects; avoid intermediate structures.
- **5.4** Process data lazily (generators/iterators/streams).
- **5.5** Measure before optimizing — profile/benchmark, don't assume.
- **5.6** Keep the main thread responsive. Offload CPU-intensive work (diffing large documents, encryption of large content, compression) to Web Workers; use `requestIdleCallback`/`scheduler` for non-urgent work.
- **5.7** Avoid unnecessary React re-renders: memoize expensive components, keep state as local as possible, avoid re-creating callbacks/objects in render, and keep `useFileStore` subscriptions scoped.
- **5.8** Minimize DOM churn and layout instability: avoid layout thrash, use virtualization for long lists (file lists, search results, large-document views), and batch DOM reads/writes.
- **5.9** Be garbage-collection aware: avoid retaining references to large strings/blobs, release workers and event listeners, and do not hold whole-document copies in module scope when only a delta is needed.
- **5.10** Bundle size is a performance budget: lazy-load everything non-critical (editor, sync engine, crypto, jsondiffpatch already live in separate chunks — keep it that way), use dynamic imports and tree shaking, and monitor the bundle with `vite build` analysis.
- **5.11** Respect the event loop: never block it with long synchronous loops; chunk large processing and yield between chunks.

### 6. DRY

- **6.1** Every piece of knowledge exists once.
- **6.2** Extract repeated patterns into reusable functions/utilities/services/components.

### 7. Error handling & resilience

- **7.1** Fail predictably: descriptive, actionable, recoverable when appropriate, logged, never silently ignored.
- **7.2** Validate inputs early at system boundaries (user input, API responses, files, env vars, DB records, external services).
- **7.3** Network failures are expected, not exceptional. Sync failures must persist to the local queue and retry with backoff — never drop user edits, never throw away queued operations on error.
- **7.4** Never lose data: a failed write to the server is a local problem, not a user-data problem. User content must survive any combination of network/server failures.
- **7.5** Validate all data coming from the server before use; treat synced content as untrusted input (it may be corrupt, malicious, or from a different app version).

### 8. Security

- **8.1** Never trust external data — treat as malicious until validated/sanitized.
- **8.2** Use established libraries for crypto, hashing, JWT, OAuth, auth, password storage, certificates — never hand-rolled.
- **8.3** Principle of least privilege.
- **8.4** End-to-end encryption by design: content and deltas are encrypted client-side before they leave the browser; the server stores opaque blobs and must never see plaintext content, deltas, or keys.
- **8.5** Key handling: derive/store keys with Web Crypto best practices; never log, persist insecurely, or transmit keys; keep keys out of IndexedDB unless explicitly designed for (and then encrypted).
- **8.6** XSS is the top client risk: keep CSP strict (`default-src 'self'`), never inject raw HTML, escape/encode any user-derived strings before rendering, and sanitize imported document content.
- **8.7** Secure IndexedDB usage: validate every record read from IndexedDB, treat stored blobs as untrusted (they may be from an older schema version or tampered), and ensure decryption failures fail loudly with recovery, not silent corruption.
- **8.8** Never log secrets: no tokens, keys, passwords, or document content in client console or server logs.

### 9. Documentation

- **9.1** Document decisions/why, assumptions, trade-offs — not the obvious.
- **9.2** Document public interfaces: purpose, params, returns, exceptions, examples, limitations, perf considerations.
- **9.3** Keep docs current — update related docs in the same change set.
- **9.4** Every significant feature must document: architecture, browser execution flow, synchronization lifecycle, failure modes, recovery strategy, performance and scalability considerations, security implications, and the reasoning for architectural decisions.
- Note: this overrides the "no comments" convention only for docs/decision documentation, not inline noise.

### 10. Testing

- **10.1** Test behavior, not implementation.
- **10.2** Automate unit/integration/regression tests, linting, formatting, security scans, dependency audits, perf benchmarks, CI/CD.
- **10.3** Test the local-first contract: offline operation (queue accumulates, app functional), sync correctness (batch boundaries, rebase/conflict resolution via 3-way merge, staleness), encryption round-trips, and graceful degradation (no `crypto.subtle`).
- **10.4** Verify in real browsers, not just build: IndexedDB persistence, Service Worker caching/offline shell, and `sendBeacon` flush behavior.

### 11. Readability

- **11.1** Names explain intent — no comments needed to explain what.
- **11.2** Reduce nesting: early returns, guard clauses, small helpers.
- **11.3** Consistent style via formatter/linter.

### 12. Dependencies

- **12.1** Prefer official SDKs.
- **12.2** Remove unused dependencies (attack surface, build time, maintenance).
- **12.3** Keep dependencies updated with verification via automated tests.
- **12.4** Every dependency must be justified by measurable value across: active maintenance, security, bundle size, browser compatibility, performance impact, and long-term maintainability. Prefer native browser APIs, ECMAScript features, and standard libraries first.
- **12.5** A dependency that replaces only a few lines of straightforward code is not justified — write the few lines. Each dependency costs bytes, attack surface, and update burden; the client bundle is a hard budget.

### 13. Architecture

- **13.1** Design for change — modular, loosely coupled.
- **13.2** Composition over inheritance.
- **13.3** Separate concerns: UI (presentation-focused components), storage (abstracted persistence layer over IndexedDB), synchronization (isolated engine), encryption (independent of sync — any sync consumer can encrypt/decrypt), business logic.
- **13.4** Layers must communicate through narrow interfaces: storage is abstracted so the sync engine never touches IndexedDB directly; encryption is independent of synchronization so patches can be encrypted by any caller; UI components stay presentation-focused and never reach into sync internals.
- **13.5** Prefer dependency injection for cross-layer services (engine, storage, crypto) to keep layers testable and replaceable.

### 14. Workflow

- **14.1** Build incrementally in small testable steps.
- **14.2** Refactor continuously as part of normal development.
- **14.3** Review every significant change: correctness, readability, performance, security, maintainability, architectural consistency.

### 15. AI-assisted coding

- **15.1** Demand production-quality output: secure, tested, idiomatic, minimal, efficient. Reject placeholders, speculative logic, excessive comments.
- **15.2** Verify AI output critically (correctness, perf, security, edge cases, standards).
- **15.3** Regularly simplify: reduce code size, eliminate duplication, replace custom logic with libraries, improve naming, strengthen docs.
- **15.4** Before proposing any change, AI must analyze the existing architecture and search for reusable utilities, existing abstractions, native browser APIs, framework capabilities, and project conventions — then reuse them rather than generate new code.
- **15.5** AI must never introduce speculative abstractions, unnecessary wrappers, excessive configuration, premature optimization, or architectural changes without measurable justification. Reject generated code that duplicates an existing module.

### 16. Decision hierarchy

Native browser API → platform/stdlib → framework → official SDK → mature third-party library → external service/API → reuse existing project code → only then write new custom code (small, modular, tested).

### 17. Final checklist

Before considering a feature complete: simplest correct solution? existing solution searched? no reinvented stdlib? every line necessary? modular/reusable? clear names? inputs validated? explicit error handling? security best practices? efficient algorithm? expensive ops cached? no duplicates? deps justified/current? linted/formatted? tests comprehensive and passing? public APIs documented? decisions/trade-offs documented? profiled where it matters? reviewed? understandable by another engineer with minimal explanation?

### 18. Local-first architecture

- **18.1** The client is the source of truth. `useFileStore`/IndexedDB hold the authoritative document state; the server is a mirror for backup and cross-device sync, never an authority.
- **18.2** Do work where the data is: local search, local filtering, local indexing, local diffing, local compression, local encryption, local validation — all client-side. Never send documents to the server to be processed.
- **18.3** The server stays stateless and dumb: it stores opaque encrypted blobs and version metadata, authenticates devices, and returns what it is asked for. No document parsing, no content inspection, no business rules.
- **18.4** Features must degrade gracefully without a server: creating, editing, saving, searching, and rendering must work with cloud sync disabled or unreachable.
- **18.5** Prefer browser-native capabilities for every new feature: IndexedDB before embedded databases, `crypto.subtle` before crypto libraries, Service Worker before background sync scripts.

### 19. Network minimization

- **19.1** Every network request is expensive: it costs bandwidth, server CPU, database writes, battery, and latency. Only send what is necessary, only when necessary.
- **19.2** Batch: coalesce sync ops into single requests (≤100 ops/request, 3s flush debounce — keep these limits).
- **19.3** Debounce and throttle: autosave (500ms debounce), blur flush, and periodic pulls must not fire more often than needed; never pull more than once per staleness window (5 min).
- **19.4** Use delta synchronization: send encrypted jsondiffpatch deltas, not full content, except for initial `base` ops.
- **19.5** Optimistic updates: reflect local edits immediately in the UI; synchronization happens in the background — the user must never wait for the network.
- **19.6** Cache aggressively: stale-while-revalidate for metadata, staleness-cached pulls, private HTTP caching where the server permits, and service-worker caches for assets.
- **19.7** Minimize: bandwidth, server CPU, database operations, storage writes, API calls, serialization overhead, and synchronization frequency. A change that doubles API traffic without measurable user value is rejected.
- **19.8** Background sync: use `navigator.sendBeacon` for best-effort `beforeunload` flush; never block page teardown on sync.

### 20. Offline-first & resilience

- **20.1** The app must function identically offline: edits save to IndexedDB, the queue persists pending ops, and the UI never blocks on connectivity.
- **20.2** Pending operations survive restarts: the `sync_queue` store is durable; a queued op is only removed after the server acknowledges it.
- **20.3** Retry with backoff on failure; never drop or overwrite queued operations because of transient errors.
- **20.4** Conflict resolution: stale-version responses trigger a rebase; reconcile local unsynced edits with remote content via 3-way merge (`mergeText()`) — never clobber either side silently.
- **20.5** On reconnect (`online` event / next user action), flush the queue and pull missed updates automatically.
- **20.6** During `beforeunload`, best-effort flush via `sendBeacon`; accept that it may not arrive — the queue is the source of truth.

### 21. Storage & IndexedDB best practices

- **21.1** Keep the IndexedDB schema versioned (`textpad`, v4) and migrate explicitly in `onupgradeneeded`; never break old databases silently.
- **21.2** Use single-transaction read-then-write patterns (as in `updateFile()` at `db.ts:122`) to keep records consistent; never write partial records.
- **21.3** Keep per-record operations bounded: use keys/indexes, avoid full-store scans, and never load every file's content into memory at once.
- **21.4** Content stored in IndexedDB is encrypted at rest (with the documented cleartext degradation only when `crypto.subtle` is unavailable).
- **21.5** Respect browser storage limits and eviction: keep the data model lean, drop stale versions, and treat storage quota errors as recoverable failures.
- **21.6** The `baseContent` baseline exists to compute deltas cheaply — keep it in sync with the last synced version so diffs stay minimal.

### 22. Synchronization design rules

- **22.1** Sync is a background service, never part of the render path. Enqueue, debounce, flush; UI never awaits sync completion.
- **22.2** Preserve versioned patch semantics: per-file versions, `?since=N` incremental history, stale-version → rebase, 3-way merge for local/remote divergence.
- **22.3** Respect server limits: ≤100 ops/request, 1MB max patch, ≤50 versions/file; never retry in a tight loop against rate limits (120/min, 5/hr registration).
- **22.4** Encrypt every op payload before enqueueing; the queue may hold only encrypted content (per `encryptContent()` semantics).
- **22.5** Registration happens once per browser and credentials are persisted in the `keychain` store; re-register only when credentials are missing.
- **22.6** Delete propagation: file deletion enqueues and syncs; tombstone/delete must not resurrect on the next pull.

### 23. Client-side encryption

- **23.1** Encrypt before anything leaves the device: content, deltas, and metadata that is private must be encrypted client-side before enqueue or transport.
- **23.2** AES-256-GCM via Web Crypto (`crypto.subtle`); key material handled via `crypto-init.ts` module state — never persisted by default, never logged, never sent to the server.
- **23.3** The `~enc~` prefix protocol (`encryptContent`/`decryptContent`) is the contract between encryption and storage/sync; any new encrypted field must follow it.
- **23.4** Graceful degradation is explicit and loud: when `crypto.subtle` is unavailable, fall back to cleartext only with a visible warning (as in `main.tsx:7`); never silently degrade.
- **23.5** Decryption failures must be recoverable: detect `~enc~`-prefixed blobs that fail to decrypt and surface a recovery path instead of silently dropping content.

### 24. Service worker & caching strategy

- **24.1** Precache the app shell (`precacheAndRoute`); the app must launch and render offline.
- **24.2** API requests: network-first with cache fallback; never serve stale sync responses as authoritative.
- **24.3** Assets: cache-first — hashed build assets are immutable; never revalidate them on every navigation.
- **24.4** The service worker must not cache or log encrypted content beyond what the app explicitly caches; cache entries must respect the same privacy rules as the network.
- **24.5** Version the cache/`injectManifest` on every deploy so schema and chunk changes never serve stale code.

### 25. Large document handling

- **25.1** Never block the main thread on large documents: diff, encrypt, and compress big content in Web Workers.
- **25.2** Virtualize long lists and large-document views; render only what is visible.
- **25.3** Process lazily: read/decrypt content on demand, not at store load; keep whole-document strings out of hot paths.
- **25.4** Keep deltas small even for big files: diff against `baseContent`, batch writes, and avoid recomputing full content unless required.

### 26. Progressive enhancement & graceful degradation

- **26.1** Features must define a degraded mode: missing `crypto.subtle` (cleartext + warning), no Service Worker (network-first, no offline shell), storage quota exceeded (recoverable error), unsupported API (feature off, app intact).
- **26.2** The core experience (create, edit, save locally) must never depend on enhanced capabilities.
- **26.3** Detect and warn about insecure contexts / missing APIs early (`main.tsx:7` pattern), but never crash.

### 27. Server responsibility boundary

- **27.1** The server's entire responsibility: authentication (HMAC tokens), device registration, storing/returning opaque encrypted blobs with version metadata, and rate limiting. Nothing else.
- **27.2** The server must never receive, store, or process plaintext document content or keys.
- **27.3** No business logic server-side: no search, no diffing, no content validation, no document processing.
- **27.4** The server stays stateless horizontally: any instance can serve any device; in-memory caches (as in `store.js`) must remain consistent across restarts via disk flush.
- **27.5** A client feature that requires new server behavior is a red flag: re-examine whether the work belongs on the client.

### 28. Code Quality Standards

#### 28.1 Production-First Mindset

Every piece of code must be written as if it will be deployed to production immediately after review. Temporary solutions, experimental shortcuts, debug-only implementations, placeholder logic, TODO-based functionality, hardcoded values, or incomplete implementations are prohibited unless explicitly requested. Every function should be resilient against invalid input, unexpected states, race conditions, and future extensions.

#### 28.2 Self-Documenting Code

Code should communicate intent naturally through descriptive names, logical structure, and modular organization. Comments should explain architectural decisions, trade-offs, assumptions, or complex algorithms—not obvious implementation details.

Poor: `if (a)` — Good: `if (userHasPermission)`

#### 28.3 Eliminate Magic Numbers

Never hardcode unexplained numeric values, strings, or repeated literals. Instead use constants, enums, configuration, or environment variables. Every constant should have meaningful naming.

#### 28.4 No Hidden Side Effects

Functions should perform only what their name suggests. Avoid functions that unexpectedly modify global state, perform database writes, make network requests, change unrelated objects, or mutate input unexpectedly. Predictability always wins.

### 29. Clean Architecture Principles

#### 29.1 Dependencies Flow Inward

Higher-level business logic must never depend directly on implementation details:

```
Business Logic
     ↓
   Services
     ↓
 Repositories
     ↓
   Database
```

Never reverse this dependency.

#### 29.2 Dependency Injection

Avoid constructing dependencies inside classes whenever possible. Instead inject services, repositories, clients, and configuration. This improves testing, maintainability, and flexibility.

#### 29.3 Loose Coupling

Every module should know as little as possible about other modules. Communication should happen through interfaces, contracts, events, or abstractions — never through internal implementation details.

### 30. API Design Standards

#### 30.1 APIs Must Be Predictable

APIs should be consistent, versioned, documented, and backwards compatible. Breaking API changes require explicit justification.

#### 30.2 Consistent Error Responses

Every API error should include an error code, message, status, and trace identifier (if applicable). Never expose stack traces.

#### 30.3 Pagination

Large datasets must support pagination, filtering, sorting, and searching. Never return unbounded datasets.

#### 30.4 The server API is minimal by design

A new endpoint must prove it cannot be done client-side. Endpoints exist only for sync coordination, auth, and encrypted storage; content-bearing endpoints never touch plaintext.

### 31. Database Rules

#### 31.1 Database Is Not Business Logic

Complex business rules belong in application code. Database responsibilities: persistence, indexing, constraints, transactions.

#### 31.2 Optimize Queries

Avoid `SELECT *`, N+1 queries, duplicate joins, and unnecessary indexes. Always profile slow queries.

#### 31.3 Transactions

Operations that modify multiple records must be atomic — either everything succeeds or everything rolls back.

#### 31.4 Migrations

Database schema changes must always be versioned. Never manually edit production databases.

#### 31.5 Two databases, two contracts

The client IndexedDB is the primary store (versioned schema, `textpad` v4, 4 stores); the server SQLite stores only opaque encrypted blobs and sync metadata. Neither may assume the other's schema. Keep IndexedDB migrations versioned and the server schema migration-safe.

### 32. Logging Standards

#### 32.1 Structured Logging

Every log should contain timestamp, severity, module, operation, request ID, and user/device ID (when appropriate).

#### 32.2 Never Log Sensitive Data

Never log passwords, tokens, API keys, encryption keys, session cookies, payment information, or personal data unless absolutely necessary. In TextPad this includes: document content, plaintext or encrypted, and key material.

#### 32.3 Meaningful Logs

Logs should answer: what happened? where? why? how severe? Keep client logging minimal (console is a privacy surface); server uses pino.

### 33. Configuration Rules

#### 33.1 Configuration Over Code

Never hardcode URLs, credentials, API keys, feature flags, ports, or limits. Everything configurable belongs in env vars or config files.

#### 33.2 Environment Separation

Maintain separate configuration for Development, Testing, Staging, and Production. Never mix environments.

### 34. Memory & Resource Management

#### 34.1 Always Release Resources

Always clean up timers, sockets, database connections, streams, file handles, workers, and subscriptions. Never leak resources.

#### 34.2 Lazy Initialization

Initialize expensive resources only when actually needed. Avoid unnecessary startup costs.

#### 34.3 Cache Responsibly

Every cache should define TTL, invalidation strategy, memory limits, and eviction policy. Never create permanent caches unintentionally.

#### 34.4 Be GC-aware in the browser

Release Web Worker references, revoke object URLs, drop detached listeners, and avoid retaining large content strings in module or closure scope after they are no longer needed.

### 35. Concurrency

#### 35.1 Avoid Shared Mutable State

Immutable data reduces race conditions, synchronization complexity, and hidden bugs.

#### 35.2 Thread Safety

Every concurrent component must explicitly define ownership, synchronization, and locking strategy.

#### 35.3 Async First

Never block the event loop with long-running synchronous operations. Prefer async I/O, workers, and queues.

#### 35.4 The browser has threads

Use Web Workers for CPU-heavy client work (large-document diffing/encryption) and keep the main thread for UI. Coordinate via structured messages, never shared mutable state.

### 36. Scalability Rules

#### 36.1 Design For Growth

Assume users increase, data grows, traffic spikes, and requests multiply. Avoid designs that scale only for today's workload.

#### 36.2 Horizontal Scalability

Avoid assumptions that require a single server. Stateless services are preferred.

#### 36.3 Backpressure

Every queue, worker, and pipeline should have limits, retries, timeouts, and rate limiting.

#### 36.4 Scale on the client too

Design for many files (1000/device), large documents, and long sessions: virtualized lists, per-file lazy loading, bounded memory, and queue limits — the browser is the primary runtime and must stay responsive as data grows.

### 37. Code Review Standards

Every pull request should evaluate correctness, readability, maintainability, architecture, security, performance, testing, documentation, edge cases, sync correctness (versioning, conflict resolution, queue durability), and privacy (no plaintext/key leakage). Approval means the reviewer understands every significant change.

### 38. Refactoring Rules

Refactor whenever code becomes duplicated, difficult to read, difficult to test, tightly coupled, or deeply nested. Never postpone obvious cleanup indefinitely.

### 39. AI Coding Rules

When AI generates code, it must:

- analyze the existing architecture before proposing changes
- search for reusable utilities, existing abstractions, native browser APIs, and framework capabilities first
- reuse existing project infrastructure and conventions
- minimize code generation: eliminate duplicate logic, simplify algorithms, reduce bundle size, reduce complexity
- prefer mature libraries over custom implementations where appropriate
- preserve project conventions
- minimize new abstractions
- avoid duplicate implementations
- avoid speculative functionality
- avoid unnecessary wrappers, excessive configuration, and premature optimization
- never introduce architectural changes without measurable justification
- optimize for maintainability

Reject AI output that introduces unnecessary complexity, dead code, or anything that duplicates an existing module.

### 40. Performance Checklist

Before writing code ask:

- [ ] Can this use an existing library?
- [ ] Can this use an existing service?
- [ ] Can this use a native browser API instead of JavaScript?
- [ ] Can this be deleted entirely?
- [ ] Can this be simplified?
- [ ] Can fewer allocations be used?
- [ ] Can fewer API calls be made?
- [ ] Can fewer database queries be executed?
- [ ] Can results be cached?
- [ ] Can work happen lazily?
- [ ] Can work happen off the main thread?
- [ ] Can this be parallelized safely?
- [ ] Is the algorithm optimal?
- [ ] Does this add bytes to the main bundle?
- [ ] Does this trigger unnecessary re-renders or DOM churn?
- [ ] Does this increase network traffic or sync frequency?
- [ ] Has it been benchmarked?

### 41. Documentation Requirements

Every significant feature should include: Purpose, Architecture, Data Flow, Browser Execution Flow, Synchronization Lifecycle, Dependencies, Configuration, Failure Modes, Recovery Strategy, Performance Considerations, Scalability Considerations, Security Implications, Known Limitations, Future Extension Points, and the reasoning for architectural decisions. Documentation should enable a new engineer to understand the feature without reading every source file.

### 42. Release Readiness Checklist

No feature is considered complete until all of the following are true:

- Builds successfully
- Lint passes
- Formatter passes
- Type checking passes
- Unit tests pass
- Integration tests pass
- Dependency audit clean
- Bundle size analyzed and within budget
- Performance profiled (main-thread time, memory)
- Accessibility validated
- Security scan clean (CSP, XSS, key handling, no plaintext leakage)
- Synchronization correctness verified (batching, versions, rebase/3-way merge, queue durability)
- Offline functionality verified (launch, edit, save, sync-on-reconnect)
- Browser compatibility verified (feature detection, degradation paths)
- Memory profiling clean (no leaks in workers, listeners, caches)
- Network efficiency verified (request count, payload sizes, cache hit behavior)
- Documentation updated
- API documentation updated
- Breaking changes documented
- Migrations documented (IndexedDB schema, server schema)
- Logging verified (structured, no sensitive data)
- Monitoring added where appropriate
- Error handling verified (recoverable, no silent data loss)
- Feature flags removed if obsolete
- Dead code removed
- Temporary code removed
- TODOs resolved
- Debug code removed
- Production hardening reviewed

### 43. Golden Rule

Before writing any new code, always ask:

1. Can this be solved without writing code?
2. Does the operating system already provide this?
3. Does the browser already provide this (native API)?
4. Does the language standard library provide this?
5. Does the framework already provide this?
6. Is there an official SDK?
7. Is there a mature, widely adopted library?
8. Can existing project code be reused?
9. Can the problem be simplified?
10. Can fewer lines achieve the same result?
11. Will another engineer understand this instantly?

If the answer to any earlier question is "yes", do not proceed to later steps.

The highest-quality software is not the one with the most code—it is the one with the least custom code necessary to achieve correctness, maintainability, security, scalability, and long-term reliability.

## opencode (agent-specific behavior)

- **Verify every change before reporting done**: client changes → `npm run build` in `client/` (runs `tsc -b && vite build`, strict); server changes → `npx eslint .` in `server/`. Both must pass.
- **Never run `npm run dev`** (doesn't exist). When asked to run the app, start server (`npm run server`) and client (`npm run client`) in separate terminals.
- **Do not modify `Docs/`, this AGENTS.md, or `opencode.json` unless explicitly asked.**
- **Never commit or push** unless explicitly asked. No git repo at root — `client/` and `server/` are separate deploy repos.
- **No dependency changes without asking**: never `npm install`/`npm uninstall` without explicit user request.
- Use the `explore` subagent for codebase research instead of scanning files yourself.
- Keep diffs minimal and scoped to the request. Prefer editing existing files over creating new ones.
- Default to showing instead of running long-lived commands (`npm run server`, `npm run client`); let the user run them in their own terminals.
