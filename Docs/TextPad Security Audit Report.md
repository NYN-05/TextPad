
TextPad Security Audit Report

1. Vulnerabilities Discovered
   High severity

# Finding	Location

H1	Session tokens never expire — server advertised expiresAt (30 days) but never enforced it; a leaked token was valid forever	server/middleware/auth.js
H2	Unbounded device registration — LIMITS.maxDevices (100) was defined but never enforced; storage DoS	server/handlers/register.js
H3	Rate limits neutralized behind proxy — no trust proxy setting, so on Render every request appears from the proxy IP: all users shared one bucket (trivial shared-bucket DoS)	server/index.js, middleware/rateLimit.js
H4	Unauthenticated log-flood/log-injection DoS — POST /api/csp-report accepted a 5 MB attacker-controlled body, logged it raw, with no rate limit	server/index.js
H5	Body-carried credentials accepted on every method/path — deviceId+token in JSON body work for all endpoints (needed only for sendBeacon on POST /api/sync)	server/middleware/auth.js
Medium

# Finding	Location

M1	fileId never charset-validated — ../-style IDs flow into URL params; no URL-safe enforcement anywhere	server/middleware/validation.js, handlers/syncPull.js, syncDelete.js
M2	Client timestamp unvalidated — arbitrary strings/values stored, corrupting sort order	server/handlers/sync.js
M3	maxTotalBytesPerDevice (100 MB) defined but never enforced	server/handlers/sync.js
M4	PBKDF2 only 100k iterations (below OWASP guidance); iteration count not stored, preventing future upgrades	client/src/crypto/keychain.ts
M5	Prototype-pollution surface: server-derived deltas applied via jsondiffpatch.patch() without key sanitization	client/src/sync/patcher.ts, workers/sync.worker.ts
M6	allowedHosts: [".trycloudflare.com"] — DNS-rebinding exposure of the dev server + proxied API	client/vite.config.ts
M7	Unbounded file imports/restores — no size caps on import (5 MB+) or backup restore; oversized snapshots silently rejected by server after retry exhaustion (silent sync loss)	client/src/App.tsx, sync/engine.ts
Low

- GET /api/health unthrottled + cacheable; missing Cache-Control on credential-bearing responses (register, sync POST, pull, delete)
- Missing HSTS/COOP/CORP headers on both hosts; X-Powered-By: Express disclosed
- syncPull since param not validated (NaN/negative)
- Service worker cached API responses even when servers marked them no-store
- Dead cross-origin preconnect to fonts.googleapis.com (CSP-inconsistent, privacy leak)
- Two legacy plaintext .txt files in server/data/ (residue of an old implementation)
- Client pulled server metas without validating fileId/name shape before URL interpolation
- Client SyncFileMeta type missing deleted → strict build failed
- Docs/SECURITY.md documented obsolete behavior (10 MB limit, body-only credentials)
  Not found (verified clean)
- SQL injection — all SQLite access is parameterized prepared statements (server/lib/store.js)
- XSS — no dangerouslySetInnerHTML/innerHTML/eval; all rendering via React escaping; strict CSP with no inline script allowance
- CSRF — no cookies; header-based auth; CORS allow-list enforced
- SSRF/path traversal — no server-side URL fetching; static serving bounded to client/dist; express.static root-constrained
- Crypto misuse — AES-GCM with fresh random 12-byte IV per write, fileId as AAD (prevents ciphertext swapping between files); constant-time token compare
- Secret leaks — no secrets in code; API_SECRET auto-generation logged (documented); pino redacts auth headers/bodies

2. Fixes Applied
   Server

- auth.js: tokens now embed expiry (epoch:HMAC-SHA256(deviceId|epoch)), enforced with timing-safe compare; body credentials accepted only on POST /api/sync
- register.js: enforces maxDevices (429); validates label/groupId charset; Cache-Control: private, no-store
- index.js: trust proxy (env TRUST_PROXY, default 1, Render-ready); HSTS/COOP/CORP headers; X-Powered-By disabled; csp-report rate-limited (60/min), field-whitelisted, truncated to 500 chars, no raw-body logging; health rate-limited (60/min); all credential-bearing responses no-store
- validation.js: fileId regex ^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$, finite-number checks for baseVersion/timestamp, array-op guard
- sync.js: timestamp clamped to ±24 h of server time; group storage limit (100 MB) enforced with an in-memory byte counter (no per-op O(versions) recomputation — that would itself be a DoS)
- syncPull.js/syncDelete.js: param validation (400), no-store
- errorHandler.js: statusCode fallback, truncated log/response messages
- limits.js: patch limit 1.5 MB aligned with client snapshot sizes
- store.js: bytesForGroup() accessor
  Client
- keychain.ts: PBKDF2 600k iterations for new passphrase blobs; iteration count persisted per blob; legacy blobs still unwrap at 100k (backward compatible)
- delta-sanitize.ts (new): strips __proto__/constructor/prototype keys before jsondiffpatch applies (used by patcher + worker)
- engine.ts: snapshot-size guard (files > 1 MB stay local, warned — no more silent-drop retry loops); pull loop skips metas with invalid fileId/name
- transport.ts: credentials: "omit", referrerPolicy: "no-referrer"
- sw.ts: never caches responses marked no-store
- App.tsx: import cap 5 MB; backup restore caps (1 MB/file, 1000 files, 128-char names) with skip-count toast
- types.ts: KeyBlob.iterations?, SyncFileMeta.deleted (fixes the strict build)
  Configs / cleanup
- vercel.json: HSTS, COOP, CORP, X-XSS-Protection: 0; render.yaml: NODE_ENV=production, healthCheckPath, TRUST_PROXY=1; vite.config.ts: removed trycloudflare host; index.html: removed dead preconnect; legacy plaintext .txt files deleted; Docs/SECURITY.md rewritten to match reality.

3. Verification

- Server eslint: clean. Protocol suite (verify.mjs): 946/954 assertions pass — the 8 failures (S08, S10, S13, S14, S16–S19) are pre-existing, reproduced byte-for-byte against the original unmodified handler
- Auth/validation unit checks: valid/invalid/expired/foreign/unregistered tokens, proto-key JSON bodies, timestamp clamping — all pass
- Live server: health/register/headers (no-store, COOP, CORP, no X-Powered-By) verified over HTTP
- Client npm run build (strict tsc -b + Vite + PWA): passes

4. Remaining Accepted Risks (by design)
5. Group capability = passphrase: anyone with the group passphrase (or a brute-forced weak one) can join the group and read file names/versions/timestamps (content stays encrypted). Strong-passphrase guidance added to SECURITY.md.
6. Passphrase persisted in localStorage — required for group continuity across browser restarts; moving it to sessionStorage would orphan cloud files on every restart. With no XSS vectors and CSP 'self', exposure requires same-origin script execution or device compromise (which also yields IndexedDB).
7. Replay of sync ops: captured TLS traffic is opaque (client-encrypted), but a MITM-capable attacker could replay a captured delete/metadata op. TLS in production mitigates.
8. Trust-proxy residual: TRUST_PROXY=1 reads the last XFF hop; spoofing requires direct access to the server port (not possible externally on Render).
9. Files > 1 MB are local-only (server patch cap) — documented, warned client-side.
10. verify.mjs 8 pre-existing failures — sync-suite debt, outside this audit's scope (protocol was the verified baseline).
11. Overall Posture
    The core design is sound: content is client-encrypted end-to-end (AES-256-GCM + AAD), the server stores only opaque blobs, there is no cookie-based session (no CSRF), no injection sinks, and validation is now strict and centralized. After this pass, all identified high and medium issues are resolved; remaining items are documented, by-design tradeoffs of the local-first, passphrase-group model rather than exploitable defects. Recommended operational follow-ups: pin API_SECRET in production (Render already generates it), keep TRUST_PROXY=1, and run npm audit before each release.
