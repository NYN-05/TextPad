# TextPad Architecture & Code Flow

> A **local-first** encrypted text editor with optional cloud sync. React 18 + TypeScript + Vite 6 (client, deployed on Vercel), Express 4 ESM + SQLite (server, deployed on Render).
>
> **Design goal:** minimize backend computation, requests, and cost. Everything that can run on the user's device does — the backend only authenticates and persists opaque blobs. See [DEPLOYMENT.md](DEPLOYMENT.md) for the decision log.

---

## 1. Application Initialization (Page Load)

```
index.html
  └─ <div id="root">
  └─ <script type="module" src="/src/main.tsx">
       ├─ createRoot(document.getElementById("root"))
       ├─ <StrictMode>
       ├─ <ErrorBoundary>
       └─ <App />                  ← app entry
```

### 1.1 Entry point — `client/src/main.tsx`

1. Checks `globalThis.crypto?.subtle` — warns to console if unavailable (cleartext only).
2. Renders `<App>` wrapped in `<StrictMode>` + `<ErrorBoundary>`.

### 1.2 App component — `client/src/App.tsx`

`AppInner` is the central orchestrator. View states: `"landing" | "loading" | "dashboard" | "editor" | "notfound"`.

#### State hooks

| Hook | What it does |
|---|---|
| `useFileStore()` | Loads all `LocalFile[]` from IndexedDB (single source of truth) |
| `useActiveFile()` | Tracks `activeId` + `fileData` |
| `useUI()` | Responsive sidebar, online/offline detection, save/sync indicators |
| `useCrypto()` | Initializes Keychain (loads/generates AES key) |
| `useAutosave(fn)` | Debounced local save with `flush()` |
| `useSettings()` | AppSettings persisted to localStorage (**cloudSync defaults OFF**) |
| `useSearch()` | File name + content search — debounced 150ms, results capped, fully local |
| `useKeyboardShortcuts()` | Ctrl/Cmd + key combos |
| `useActivityLog()` | Activity history persisted to localStorage |
| `useStorageEstimate()` | `navigator.storage.estimate()` (local, no network) |

#### Startup effect (runs once via `initRef` guard, after leaving landing)

```
STEP 1: loadFiles()                    ← IndexedDB only; no network
STEP 2: onboarding check + first-run file creation
STEP 3: "beforeunload" listener → engine.flushBeacon() (best-effort, navigator.sendBeacon)
```

#### Cloud sync effect (only when `settings.cloudSync === true`)

```
SETTINGS.cloudSync && engineRef empty?
  │
  ├─ dynamic import("./sync/engine")   ← engine + jsondiffpatch NOT in the main bundle
  ├─ engine.init()                     ← reuse persisted credentials from IndexedDB,
  │                                       or POST /api/sync/register once per browser
  ├─ engine.syncAll()                  ← push all unsynced/changed local files (batched)
  └─ engine.pull()                     ← GET /api/sync metadata (staleness-cached 5 min),
                                          pull divergent files, apply patches locally
```

---

## 2. Storage Layer — IndexedDB v5

### 2.1 Database: `"textpad"` version 5

| Store | Key | Purpose |
|---|---|---|
| `files` | `id` | File content + metadata + `baseContent` (v4) |
| `sync_queue` | autoIncrement | Pending sync operations (superseded per file) |
| `keychain` | `key` | Crypto key blobs + persisted `sync-credentials` |
| `sync_meta` | `key` | Sync metadata (staleness cache, etc.) |

### 2.2 File record (`LocalFile`, `client/src/db.ts`)

```typescript
interface LocalFile {
  id: string;          // UUID
  name: string;
  content: string;     // encrypted at rest ("~enc~" prefix)
  createdAt: number;
  updatedAt: number;
  syncedAt: number;    // 0 = never synced
  version: number;     // server version this file is known to be at
  baseContent?: string; // plaintext at server `version` — the diff baseline (encrypted at rest)
}
```

`baseContent` is the **diff baseline**: the sync engine computes `diff(baseContent, content)` so only changes since the last successful sync are sent. Legacy records without `baseContent` are treated as never-synced (full snapshot op).

### 2.3 Key operations

| Function | Description |
|---|---|
| `getAllFiles()` / `getFile(id)` | Read + decrypt content and baseContent |
| `addFile(file)` | Encrypt, then add |
| `updateFile(id, patch)` | Read → Object.assign → put (single transaction) |
| `createFile(name)` | New file with `baseContent: ""` |
| `enqueueOp` / `dequeueOp` / `getPendingOps` | Sync queue CRUD |
| `removePendingOps(fileId)` | Supersede stale queued ops for a file |
| `getSyncCredentials()` / `storeSyncCredentials()` | Device id + session token persisted in `keychain` store — **one registration per browser** |

---

## 3. Sync System (batched delta sync)

### 3.1 SyncEngine — `client/src/sync/engine.ts`

```
enqueue(file)
  ├─ never synced (syncedAt===0 or baseContent undefined)?
  │    └─ base op: version 1, FULL content, encrypted   (patch = encryptContent(content))
  ├─ diff(baseContent, content) via Web Worker (jsondiffpatch)
  │    ├─ empty diff + known name → skip (nothing changed)
  │    ├─ empty diff + new name  → metadata op (version unchanged)
  │    ├─ delta > 700KB chars    → base op (full content, history replaced)
  │    └─ otherwise              → delta op, version+1, encrypted
  ├─ removePendingOps(fileId) — latest op supersedes older queued ops
  └─ schedule flush (3s debounce from last enqueue)

flush()
  ├─ drain queue, batch up to 100 ops → ONE POST /api/sync
  ├─ success → per accepted file: updateFile({ baseContent, version, syncedAt })
  ├─ rejected stale/gap → rebaseFile(): send a base op (self-healing history reset)
  └─ network failure → ops stay queued with retry counter; retried on next flush/online

flushBeacon()   ← beforeunload: navigator.sendBeacon (no await possible)
deleteFile(id)  ← DELETE /api/sync/:fileId (rare, direct)
pull()          ← GET /api/sync metadata (skipped if pulled < 5 min ago)
                   per divergent file: GET /api/sync/:id?since=<localVersion>
                   decrypt + apply patches locally (Web Worker), write IndexedDB
```

Every payload sent to the server is **AES-256-GCM ciphertext** (client-side, using the same key that encrypts local storage). The server stores opaque blobs and performs zero content processing.

### 3.2 Components

| File | Role |
|---|---|
| `transport.ts` | fetch wrapper (8s timeout), `X-Device-Id` + `Authorization: Bearer` headers |
| `storage.ts` | Wraps IndexedDB `sync_queue` |
| `patcher.ts` | jsondiffpatch diff/patch (main-thread fallback) |
| `workers/sync.worker.ts` | Off-thread diff/patch (COMPUTE_PATCH / APPLY_PATCH, correlated by id) |

### 3.3 Server side

```
POST /api/sync/register   → deviceId + HMAC session token (5/hr)
POST /api/sync            → store opaque encrypted patches, versioned history (120/min)
GET  /api/sync            → device file metadata (no content)
GET  /api/sync/:id?since  → opaque version history for one file
DELETE /api/sync/:id      → delete file + history
GET  /api/health          → uptime/counts (Render monitoring)
POST /api/csp-report      → CSP violation log
```

Auth via headers (`X-Device-Id`, `Authorization: Bearer`); `POST /api/sync` also accepts body credentials for `sendBeacon`.

### 3.4 Version semantics

- Server appends a version per accepted delta op; `patch === "{}"` ops update metadata (name) without bumping versions.
- `base: true` ops **replace** history with a fresh full-content snapshot — this is how the client recovers from stale-version rejections and oversized deltas.
- Server prunes history beyond 50 versions (oldest first).

---

## 4. Encryption Layer

### 4.1 Graceful degradation

```
Web Crypto available?   yes → AES-256-GCM (local storage + sync patches)
                        no  → cleartext, console.warn + toast
```

### 4.2 Key lifecycle — `client/src/crypto/keychain.ts`

Key generated once per browser, exported raw, stored as a `type: "device"` blob in the `keychain` store; held in module memory via `crypto-init.ts`. A passphrase (AES-KW/PBKDF2) flow exists for future cross-device key sharing.

### 4.3 Storage + patch format

Both IndexedDB records and sync patches use the same envelope (see `db.ts` `encryptContent`/`decryptContent`):

```
"~enc~" + base64(ciphertext) + ":" + base64(iv)
```

AAD = file id. The server cannot read any content.

---

## 5. User Interaction Flows

### 5.1 Create / Duplicate / Import File

Local IndexedDB write, then (cloud sync on) `engine.enqueue(file)` — batched with any other pending ops and flushed 3s later. No per-operation requests.

### 5.2 Edit File

```
textarea input
  → Editor: local state + undo stack, 400ms debounce
  → App.handleContentChange → scheduleSave (500ms debounce)
  → useAutosave fires: updateFile (local, encrypted)  [always]
                       engine.enqueue(f)               [only if cloudSync]
  → Editor blur: flushSave() → doSync() → engine.flush() (immediate batched push)
```

### 5.3 Delete File

Local delete + (cloud sync) `engine.deleteFile(id)` → `DELETE /api/sync/:id`.

### 5.4 Rename File

Local rename + `doSync(id)` — produces a metadata op (empty patch + name), no version bump.

### 5.5 Backup (fully local)

- **Export:** `getAllFiles()` → JSON blob → download `textpad-backup-<date>.json`.
- **Restore:** upload a backup JSON → missing files added (encrypted at rest).
- No server involvement.

---

## 6. Server Middleware Stack

```
1. Security headers (CSP, nosniff, X-Frame-Options, etc.)
2. CORS (defaults: localhost origins + $CORS_ORIGINS env, comma-separated)
3. Content-type check (415 for non-JSON POST/PUT/PATCH)
4. express.json({ limit: "5mb" })
5. requestLogger (pino)
6. Rate limiters: register 5/hr, sync* 120/min (skip localhost)
7. Routes (register → auth middleware → handlers)
8. errorHandler (pino + JSON)
```

### Auth

`createAuthMiddleware(devices)` verifies `X-Device-Id` + `Authorization: Bearer` (or body credentials for beacon posts) via `crypto.timingSafeEqual` HMAC. The client **validates locally first** (name ≤128 chars, patch ≤700KB pre-encryption) so invalid ops never leave the device; the server keeps validation as defense-in-depth.

### Static serving

The server can still serve `client/dist` when present (single-machine mode), but the intended deployment is Vercel (static) + Render (API only).

---

## 7. Service Worker

`client/src/sw.ts` (Workbox `injectManifest`): precache app shell + sync worker; network-first for `/api/*` (dev proxy) and navigations; cache-first for assets. Fully offline-capable for local files; sync ops queue in IndexedDB and flush on reconnect.

---

## 8. Environment Variables

| Variable | Where | Default | Description |
|---|---|---|---|
| `VITE_API_URL` | client build | `""` (dev proxy) | Backend base URL, e.g. `https://textpad-server.onrender.com` |
| `PORT` | server | `3001` | Listen port |
| `API_SECRET` | server | auto-generated | HMAC key — set a fixed value in production |
| `CORS_ORIGINS` | server | localhost only | Comma-separated extra origins (your Vercel URL) |
| `LOG_LEVEL` | server | `info` | pino level |

---

## 9. Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                         BROWSER (client)                          │
│                                                                  │
│  React UI ◄── App.tsx ◄── IndexedDB v4 (files, sync_queue,       │
│  (editor,       │            keychain, sync_meta, sync-credentials)        │
│   dashboard,    ├── useAutosave → local save (always)            │
│   search...)    ├── encryption (AES-256-GCM, client-side only)   │
│                 ├── search / stats / backup / validation         │
│                 └── SyncEngine (lazy-loaded)                     │
│                      ├─ Web Worker: diff/patch (jsondiffpatch)   │
│                      ├─ enqueue → batch (≤100 ops) → flush 3s    │
│                      └─ pull: metadata + versioned patches       │
└──────────────────────────────┬───────────────────────────────────┘
                               │  HTTPS (VITE_API_URL)
┌──────────────────────────────▼───────────────────────────────────┐
│                      SERVER (Render, Express 4)                   │
│  register (HMAC) · auth middleware · rate limits · SQLite:        │
│  devices / files / file_versions / device_files                  │
│  (stores opaque encrypted patches — never reads content)         │
└───────────────────────────────────────────────────────────────────┘
```

---

## 10. Key Files Reference

### Client (`client/src/`)

| File | Role |
|---|---|
| `App.tsx` | Central orchestrator; lazy-loads the sync engine |
| `db.ts` | IndexedDB v4 wrapper, `baseContent`, credential persistence, encrypt/decrypt helpers |
| `sync/engine.ts` | Batched delta sync engine (enqueue/flush/pull/beacon) |
| `sync/transport.ts` | fetch wrapper with auth headers |
| `sync/patcher.ts` | jsondiffpatch fallback |
| `workers/sync.worker.ts` | Off-thread diff/patch |
| `hooks/useSearch.ts` | Debounced, capped, fully local search |
| `components/Dashboard.tsx` | Local export/restore backup buttons |

### Server (`server/`)

| File | Role |
|---|---|
| `index.js` | Express app — 6 routes, CORS from env |
| `handlers/register.js` | Device registration |
| `handlers/sync.js` | Batched delta sync (base/metadata/version logic) |
| `handlers/syncList.js` | Metadata list (no content) |
| `handlers/syncPull.js` | Version history since N |
| `handlers/syncDelete.js` | File deletion |
| `handlers/health.js` | Health stats |
| `lib/store.js` | In-memory Map + SQLite persistence (versioned files only) |
| `lib/database.js` | SQLite singleton (WAL), 4 tables |
| `middleware/auth.js` | HMAC sign/verify, header + body credential extraction |
| `middleware/validation.js` | Ops validation (defense-in-depth) |

---

## 11. Request Minimization Summary

| Before | After |
|---|---|
| Full plaintext file upload per autosave | Encrypted delta patches, batched ≤100 ops/request |
| Registration on every session | One registration per browser (credentials persisted) |
| N+1 startup pull, every session | 1 metadata request, stale-cached 5 min; per-file pull only on version mismatch |
| Search re-scans on every keystroke | 150ms debounce, 200-result cap |
| Sync engine in main bundle | Dynamic import — zero cost when cloud sync is off |
