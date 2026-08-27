# Security Policy — TextPad

**Last updated:** 2026-08-01

## Supported Versions
Only the latest release receives security patches.

## Reporting a Vulnerability
Open a **confidential** issue in the project repository.  
Do **not** disclose vulnerabilities publicly until they have been addressed.

## Security Architecture

### Encryption
| Layer | Algorithm | Scope |
|-------|-----------|-------|
| Local storage | AES-256-GCM | Each file encrypted with a unique random IV (12-byte, per-write) and file-id AAD before writing to IndexedDB |
| Sync transport | AES-256-GCM | Encrypted opaque blobs over HTTPS; relay cannot decrypt |
| Key wrapping | AES-KW + PBKDF2-HMAC-SHA256 (600k iterations for new blobs; 100k for legacy blobs, stored per-blob) | Content key wrapped by passphrase-derived key in the IndexedDB keychain; key never sent to server |
| Group derivation | SHA-256 | `groupId = base64url(SHA-256("textpad-group:" + passphrase))` |

### Network
- HTTPS enforced for all API communications; HSTS (`max-age=31536000`) set by both client host (Vercel) and server (Render).
- CSP headers restrict script sources to `'self'`; `frame-ancestors 'none'`; `base-uri 'self'`.
- CORS restricted to known localhost origins + `CORS_ORIGINS` env list; no cookies used (header/body auth), so no CSRF surface.
- Rate limiting applied to all API endpoints (register 5/hr, sync 120/min, health 60/min, CSP-report 60/min), keyed per client IP via `TRUST_PROXY=1`.
- Security headers on all responses: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection: 0`, `Referrer-Policy: no-referrer`, `Permissions-Policy` (camera/mic/geolocation blocked), `Cross-Origin-Opener-Policy: same-origin`, `Cross-Origin-Resource-Policy: same-origin`, `Cache-Control: private, no-store` on credential-bearing responses.

### Local Storage
- Content-Type validation rejects non-JSON payloads; body size limited to 5 MB.
- Op validation rejects unknown keys, non-numeric versions/timestamps, and non-URL-safe file IDs.
- Version chain pruned server-side to 50+1 versions per file; 1000 files/device; 100 MB/group; 100 devices total.
- Stored content is always encrypted client-side unless Web Crypto is unavailable (see constraints).

### Credentials
- Device registration issues an HMAC-SHA256 session token with a **30-day expiry embedded in the token**; expired tokens return 401 and the client re-registers transparently (same group).
- Tokens are sent via `X-Device-Id` + `Authorization: Bearer` headers; body-carried credentials are accepted **only** on `POST /api/sync` (sendBeacon path).
- The server stores no plaintext content or keys; registration is device-based; group access is governed by the passphrase-derived group ID.

## Known Security Constraints
1. **Web Crypto API** must be available in a secure context (HTTPS or localhost) for encryption.
2. If Web Crypto is unavailable, content is stored and synced in plaintext.
3. The server stores encrypted sync data in SQLite; it never has access to unencrypted content.
4. File names, versions, and timestamps are stored server-side in plaintext and visible to any device holding the group passphrase. Use a strong passphrase.
5. The sync passphrase is persisted in the app settings blob (localStorage) to preserve group access across restarts; any script executing on the app origin (XSS) or malware with device access can read it. The codebase avoids HTML injection vectors (React escaping, no `dangerouslySetInnerHTML`, strict CSP) to minimize this exposure.
6. Files larger than 1 MB (plaintext) are kept local-only and are not synced (server patch limit 1.5 MB).
7. `server/scripts/verify.mjs` currently reports 8 pre-existing protocol-suite failures (S08, S10, S13, S14, S16–S19) unrelated to this security review; the sync suite otherwise passes 946 assertions.

## Dependencies
See `package.json` files for complete dependency lists.  
Dependencies are audited regularly. Run `npm audit` before each release.
