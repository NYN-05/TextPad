# TextPad — File Map

> Complete file tree and purpose descriptions for the TextPad codebase.

```
website_1_prod/
├── AGENTS.md
├── Docs/
│   ├── ARCHITECTURE.md              # Architecture & code flow reference
│   ├── API.md                       # REST API reference
│   ├── DEPLOYMENT.md                # Vercel + Render deployment guide
│   ├── FILE_MAP.md                  ◀ (this file)
│   ├── PRIVACY.md                   # Privacy policy
│   └── SECURITY.md                  # Security policy
│
├── client/                          # React 18 + TypeScript + Vite 6 frontend (PWA)
│   ├── package.json                 # Dependencies: react 18, jsondiffpatch, vite-plugin-pwa
│   ├── package-lock.json
│   ├── vercel.json                  # Vercel config: caching, security headers, SPA rewrite
│   ├── .gitignore                   # node_modules, dist, .env (own deploy root → Vercel)
│   ├── .env.example                 # VITE_API_URL template for the Render backend
│   ├── index.html                   # HTML entry — root div, meta tags, PWA manifest
│   ├── vite.config.ts               # Vite config — React plugin, PWA injectManifest, /api proxy → :3001, manual editor chunk
│   ├── tsconfig.json                # Root TS config (references tsconfig.app + tsconfig.node)
│   ├── tsconfig.app.json            # App TS config — ES2020, React JSX, strict, includes src/
│   ├── tsconfig.node.json           # Node TS config — vite.config.ts
│   │
│   ├── public/
│   │   └── fonts/                   # Inter & JetBrains Mono TTF files
│   │       ├── Inter-Bold.ttf
│   │       ├── Inter-Medium.ttf
│   │       ├── Inter-Regular.ttf
│   │       ├── Inter-SemiBold.ttf
│   │       └── JetBrainsMono-Medium.ttf
│   │       └── JetBrainsMono-Regular.ttf
│   │
│   ├── dist/                        # Production build output (generated)
│   │   ├── index.html
│   │   ├── manifest.webmanifest
│   │   ├── registerSW.js
│   │   ├── sw.js
│   │   ├── assets/
│   │   └── fonts/
│   │
│   └── src/                         # ── Client source ──
│       ├── main.tsx                 # Entry: crypto.subtle check → renders <App> in <ErrorBoundary>
│       ├── App.tsx                  # Central orchestrator: hooks, sync init, view state machine
│       ├── index.css                # Global styles, @font-face, CSS variables, reset
│       ├── vite-env.d.ts            # Vite client types + ImportMetaEnv (VITE_API_URL)
│       ├── types.ts                 # Core interfaces: LocalFile, SyncOp, KeyBlob, SyncCredentials
│       ├── db.ts                    # IndexedDB v4 (db "textpad", 4 stores), CRUD, encryptContent/decryptContent, sync queue + credential helpers
│       ├── sw.ts                    # Service Worker: Workbox precache, network-first API/nav, cache-first assets
│       │
│       ├── components/
│       │   ├── Sidebar.tsx          # File list, rename, delete, duplicate, context menu
│       │   ├── Editor.tsx           # Text editor: undo/redo (100 steps), 400ms debounce, stats, lazy-loaded
│       │   ├── Toolbar.tsx          # Top bar: sidebar toggle, create, search, settings, sync indicator, dashboard link
│       │   ├── LandingPage.tsx      # Premium SaaS landing: hero, browser mockup, features grid, why choose, testimonials, tech strip, footer CTA
│       │   ├── Dashboard.tsx        # Dashboard: hero, search, recent files, quick actions, collapsible system status, activity drawer
│       │   ├── StatusBar.tsx        # Bottom bar: line/word/char stats, save/sync status, crypto icon, storage
│       │   ├── SearchPanel.tsx      # Search overlay: filename + content search modes
│       │   ├── SettingsDialog.tsx   # Settings modal: font, tab size, word wrap, autosave, encryption, theme, cloud sync
│       │   ├── ContextMenu.tsx      # Right-click menu: rename, duplicate, delete
│       │   ├── Toast.tsx            # Notification system: info/success/warning/error, auto-dismiss
│       │   ├── ErrorBoundary.tsx    # Class component error boundary with reset button
│       │   ├── LoadingScreen.tsx    # Initial loading with logo + 10-segment radial spinner
│       │   ├── NoFileSelected.tsx   # Empty state: "Create New File" prompt
│       │   ├── OnboardingWizard.tsx # Multi-step onboarding: storage, theme, font, autosave
│       │   ├── NotFound.tsx         # 404 page: animated SVG face, gradient 404 text, "Go Home" button
│       │   └── ConfirmDialog.tsx    # Themed modal replacing window.confirm: blur backdrop, scaleIn spring, danger icon, focus trap
│       │
│       ├── hooks/
│       │   ├── useFileStore.ts      # Single source of truth: all LocalFile[] from IndexedDB
│       │   ├── useActiveFile.ts     # Active file ID + FileData state, loadFile/unloadFile
│       │   ├── useAutosave.ts       # 500ms debounced autosave + flush on blur
│       │   ├── useCrypto.ts         # Keychain init, crypto.subtle availability
│       │   ├── useUI.ts             # Sidebar state, online/offline, save/sync indicators
│       │   ├── useSettings.ts       # AppSettings → localStorage, encryption toggle
│       │   ├── useSearch.ts         # Filename + content search, reads LocalFile[] directly
│       │   ├── useKeyboardShortcuts.ts # Ctrl/Cmd + key combos
│       │   ├── useActivityLog.ts    # Activity history → localStorage
│       │   └── useStorageEstimate.ts # navigator.storage.estimate()
│       │
│       ├── crypto/
│       │   ├── crypto-init.ts       # Module-level CryptoKey holder (setCryptoKey/getCryptoKey/clearCryptoKey)
│       │   ├── encrypt.ts           # AES-256-GCM Encrypt: generateKey, encrypt, decrypt, base64
│       │   ├── keychain.ts          # Keychain: key gen, AES-KW wrapping, PBKDF2, device/passphrase storage
│       │   └── uuid.ts              # UUID v4: crypto.randomUUID() with fallback
│       │
│       ├── sync/
│       │   ├── engine.ts            # SyncEngine (lazy-loaded chunk): init, enqueue, flush (batched ≤100 ops), pull, deleteFile, flushBeacon
│       │   ├── patcher.ts           # jsondiffpatch computePatch/applyPatch (main-thread fallback)
│       │   ├── transport.ts         # HTTP fetch wrapper (8s timeout, AbortController), X-Device-Id + Bearer auth headers
│       │   └── storage.ts           # StorageQueue wrapping IndexedDB sync_queue
│       │
│       ├── workers/
│       │   └── sync.worker.ts       # Web Worker: off-thread diff/patch (COMPUTE_PATCH/APPLY_PATCH, id-correlated; static jsondiffpatch import)
│       │
│       ├── utils/
│       │   └── fileIcon.ts          # File extension → emoji icon
│       │
│       └── styles/                  # Plain CSS per component (no Tailwind/CSS-in-JS)
│           ├── app.css              # App layout, body flex, backdrop
│           ├── landing.css          # Premium SaaS landing: backgrounds, mockup, features, testimonials
│           ├── dashboard.css        # Dashboard layout + shared loading/onboarding/no-file styles
│           ├── editor.css           # Editor pane, textarea, bar
│           ├── sidebar.css          # Sidebar panel, file list, inline rename
│           ├── toolbar.css          # Top toolbar, action buttons, sync indicator
│           ├── statusbar.css        # Bottom status bar, stats, indicators
│           ├── search.css           # Search overlay panel, tabs, results
│           ├── settings.css         # Settings modal dialog
│           ├── confirm.css          # Confirm dialog: blur backdrop, scaleIn, danger icon
│           ├── context-menu.css     # Right-click context menu
│           ├── toast.css            # Toast notification system
│           └── notfound.css         # 404 page: animated SVG face, gradient text
│
├── server/                          # Express 4 ESM backend (no build step)
│   ├── package.json                 # Dependencies: express, better-sqlite3, pino, express-rate-limit
│   ├── package-lock.json
│   ├── render.yaml                  # Render Blueprint: web service (free) — at repo root when server/ is its own repo
│   ├── .gitignore                   # node_modules, .env, data (own deploy root → Render)
│   ├── .env.example                 # PORT, API_SECRET, CORS_ORIGINS, LOG_LEVEL templates
│   ├── index.js                     # Entry: Express app, CORS from env, middleware, routes, listen :3001
│   ├── eslint.config.js             # Flat ESLint config
│   │
│   ├── data/                        # Runtime SQLite database (encrypted blobs only — no .txt content files)
│   │   ├── textpad.db               # SQLite database (WAL mode)
│   │   ├── textpad.db-shm
│   │   └── textpad.db-wal
│   │
│   ├── handlers/
│   │   ├── register.js              # POST /api/sync/register — device creation, HMAC session token
│   │   ├── sync.js                  # POST /api/sync — batched delta sync (base/metadata/version append/prune)
│   │   ├── syncList.js              # GET /api/sync — device file metadata list (no content)
│   │   ├── syncPull.js              # GET /api/sync/:fileId?since=N — opaque version history
│   │   ├── syncDelete.js            # DELETE /api/sync/:fileId — delete file + history
│   │   └── health.js                # GET /api/health — uptime, counts, memory
│   │
│   ├── middleware/
│   │   ├── auth.js                  # HMAC-SHA256 token sign/verify, X-Device-Id + Bearer extraction
│   │   ├── rateLimit.js             # 5/hr register, 120/min sync (both skip localhost)
│   │   ├── errorHandler.js          # Global error handler (pino + JSON)
│   │   └── validation.js            # Ops payload validation (defense-in-depth)
│   │
│   └── lib/
│       ├── store.js                 # In-memory Map cache + SQLite persistence via Proxy objects (flush on mutation)
│       ├── database.js              # SQLite singleton (WAL), 4 tables: devices, files, file_versions, device_files
│       ├── logger.js                # Pino logger, request logging, header redaction
│       └── limits.js                # Constants: 1000 files/dev, 50 versions/file, 100 ops/req, 128 name max, 1.5MB patch max
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     browser (client)                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐ │
│  │  React   │  │IndexedDB │  │ Service  │  │  Web       │ │
│  │  App     │◀→│ (v4:     │  │ Worker   │  │  Crypto    │ │
│  │  (PWA)   │  │ files,   │  │ (sw.ts)  │  │  API       │ │
│  │          │  │ queue,   │  │          │  │ (AES-GCM)  │ │
│  │          │  │ keychain)│  └──────────┘  └────────────┘ │
│  │          │  └──────────┘                                  │
│  │   SyncEngine (lazy): diff/patch Web Worker, enqueue,      │
│  │   batched flush (≤100 ops), pull, sendBeacon              │
│  │       │ HTTPS (VITE_API_URL)                              │
│  └───────┼───────────────────────────────────────────────────┘
│         │
│  ┌───────▼───────────────────────────────────────────────────┐
│  │  Register (HMAC) · auth · rate limits · validation         │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │  │  Express  │  │  SQLite  │  │  In-Mem  │  (opaque        │
│  │  │  Routes   │◀→│  (WAL)   │◀→│  Cache   │   encrypted      │
│  │  │           │  │          │  │ (Proxy)  │   blobs only)    │
│  │  └──────────┘  └──────────┘  └──────────┘                  │
│  │                     server (Express 4 ESM)                 │
│  └─────────────────────────────────────────────────────────────┘
```

---

## Key Stats

| Metric | Count |
|---|---|---|
| **Total source files** | ~78 |
| **React components** | 16 |
| **Custom hooks** | 10 |
| **CSS files** | 13 |
| **Server endpoints** | 6 |
| **Middleware** | 5 |
| **IndexedDB stores** | 4 (v5 schema) |
| **SQLite tables** | 4 (devices, files, file_versions, device_files) |
