# TextPad — Deployment Guide (Vercel + Render, free tiers)

> Frontend: **Vercel** (static hosting, free Hobby tier) · Backend: **Render** (free web service)
>
> **Each part is deployed from its own root** — `client/` and `server/` are pushed as two separate repositories/projects. The monorepo root is not deployed as a whole.

## Architecture split

| Concern | Where it runs | Why |
|---|---|---|
| UI, editing, autosave, search, stats, filtering | **Client** (browser) | Local-first; zero server cost |
| Encryption (AES-256-GCM at rest + patch encryption) | **Client** | Keys never leave the device; server stores opaque blobs |
| Patch computation (jsondiffpatch) | **Client** (Web Worker) | Server never processes content |
| Validation of local input (name length, patch size) | **Client** | Avoids wasted requests; server keeps a minimal validation layer as defense-in-depth |
| Backup export/restore | **Client** (JSON file download) | No server storage or bandwidth |
| Device registration, session tokens | **Server** (HMAC-SHA256) | Requires the secret (`API_SECRET`) |
| Version-history persistence | **Server** (SQLite) | Server-side database access only |
| Static files, TLS, CDN | **Vercel** | Free edge hosting, zero server compute |

**Result:** when cloud sync is disabled (the default), the app makes **zero** requests to the backend.

---

## 1. Backend — Render (free web service)

### Option A: Render Blueprint (recommended)

1. Push the contents of `server/` to its own repository, e.g. `textpad-server` (the folder's own `.gitignore` keeps `node_modules/`, `.env`, `data/` out).
2. On Render: **New → Blueprint** → select the `textpad-server` repo. `server/render.yaml` sits at the repo root, so Render finds it automatically — no root directory setting needed.

### Option B: Manual web service

1. Push `server/` as its own repository.
2. Create a **Web Service**: repo `textpad-server` → build `npm install` → start `node index.js` (root directory: leave blank/`/`).

### Environment variables (both options)

- `API_SECRET` — set a **fixed, long random string**. If unset, a new secret is generated per boot and all session tokens become invalid after each restart/sleep.
- `CORS_ORIGINS` — your Vercel URL, e.g. `https://textpad.vercel.app`
- `PORT` — Render sets this automatically.

Copy the service URL, e.g. `https://textpad-server.onrender.com`.

### Free-tier caveat: ephemeral disk

Render free web services use an **ephemeral filesystem** — the SQLite database in `server/data/` is wiped on every deploy/restart. This is **by design** for TextPad:

- Files are **always safe on the user's device** (IndexedDB) — the server is only an optional backup ledger.
- If the server loses data, the next client flush simply re-creates file records (base ops) and recovery still works from the client's local copy.
- If you want durable server storage, attach a Render **Persistent Disk** (paid) or migrate the store to a hosted DB (e.g. Supabase) — the handler layer is small and isolated for this purpose.

### Free-tier caveat: cold starts

Free services sleep after ~15 minutes of inactivity; the first request may take ~1 minute to wake. The client handles this gracefully (8s timeouts, offline queue, debounced retries), so sync simply completes on a later flush.

---

## 2. Frontend — Vercel (Hobby)

1. Push the contents of `client/` to its own repository, e.g. `textpad-client`.
2. Import it in Vercel: framework preset **Vite**; build command `npm run build`; output dir `dist`.
3. Environment variable: `VITE_API_URL=https://textpad-server.onrender.com` (build-time, must be set before building).
4. `client/vercel.json` (repo root) provides: immutable asset caching, `no-cache` for the service worker, security headers (CSP with `connect-src` allowing the Render origin), and an SPA rewrite to `index.html`.

No rewrites for `/api` — the client talks to Render directly via `VITE_API_URL` (CORS configured server-side). In local development, `VITE_API_URL` is unset and the Vite dev proxy (`/api` → `localhost:3001`) is used.

### PWA note

`vite-plugin-pwa` precaches the app shell and the sync worker; the service worker intercepts `/api/*` with network-first caching. With the backend on another origin, the SW's API branch only applies to same-origin dev requests — the PWA remains fully offline-capable for local files.

---

## 3. Deploy checklist

```sh
# 1. Build client locally to verify
cd client && npm install && npm run build

# 2. Push two separate repos
#   textpad-server ← contents of server/   (render.yaml at its root)
#   textpad-client ← contents of client/   (vercel.json + .gitignore at its root)

# 3. Set env vars
# Vercel:   VITE_API_URL=https://textpad-server.onrender.com
# Render:   API_SECRET=<random>, CORS_ORIGINS=https://textpad-client.vercel.app

# 4. Render Blueprint + Vercel import → both auto-deploy
```

> Note: the CORS value must match your actual Vercel URL (Vercel project names become `*.vercel.app` domains — e.g. `https://textpad-client.vercel.app`), not the placeholder in `server/render.yaml`.

---

## 4. Request budget on free tiers

Per active user per session (cloud sync **on**, the conservative case):

| Operation | Requests | Notes |
|---|---|---|
| Registration | 1, once per browser | Credentials persisted in IndexedDB; never re-registers |
| Startup | 0–1 | `GET /api/sync` metadata; skipped if pulled < 5 min ago |
| Saves (edits) | 1 per 3 s of idle typing, batched | All changed files coalesced into ONE `POST /api/sync` |
| Tab close | 1 best-effort | `navigator.sendBeacon` |
| Pull | per-file only on version mismatch | Patches applied locally |

Payloads are **encrypted deltas** (jsondiffpatch), typically tens-to-hundreds of bytes instead of full file contents. The sync limiter allows 120 requests/min — far above realistic usage.

---

## 5. Decision log (why the architecture is split this way)

1. **Delta sync instead of full-content PUT.** The old client uploaded the entire (plaintext!) file on every autosave. Now the client diffs against its last-synced content, encrypts the delta, and batches all files into one request. This cut per-save payloads by ~99% and per-save requests to ~1/10.
2. **Encrypted patches.** The server stores only AES-GCM ciphertext — it cannot read content, so the E2E claims in PRIVACY.md are now true. The server never runs crypto; the client does.
3. **Patch application on pull is client-side.** The server serves version history as opaque blobs; the client decrypts and applies them locally (Web Worker). The server performs zero content computation.
4. **Register once per browser.** Device credentials are persisted in the IndexedDB keychain store. Previously every session created a new device row and burned the 5/hr registration quota.
5. **Stale-cached metadata pull.** `GET /api/sync` is skipped when a pull happened < 5 minutes ago; per-file content is fetched only when versions actually diverge.
6. **Local-first defaults.** `cloudSync` defaults to off. Everything (autosave, search, stats, backup, encryption) works with no backend at all.
7. **Removed legacy endpoints.** `/api/backup` and `/api/files/*` CRUD were superseded by local backup and the batched sync API; fewer endpoints = less compute, less attack surface, less code to run on the free tier.
8. **Lazy-loaded sync engine.** The engine (and jsondiffpatch) is a dynamic import, only fetched when cloud sync is enabled — the main bundle is ~16 KB smaller.
9. **Separate deploy roots.** `client/` and `server/` are independent deployable units (own `.gitignore`, own config files), so the monorepo wrapper is never deployed.
