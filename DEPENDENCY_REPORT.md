# Dependency Report

Audit of all production and development dependencies in `client/` (Vite 6 + React 18, upgraded to Vite 7 + React 19) and `server/` (Express 4 ESM, upgraded to Express 5). Scope: version currency, maintenance status, known advisories, bundle impact, and disposition (upgrade / replace / remove / retain) with justification.

## Summary

| | Before | After | Vulnerabilities |
|---|---|---|---|
| server/ | 5 deps (4 runtime + cors) | 4 deps | 1 low → **0** |
| client/ | 8 deps + 7 devDeps | 8 deps + 7 devDeps | 4 (2 high, 1 moderate, 1 low) → **0** |
| Build | tsc -b && vite build ✓ | tsc -b && vite build ✓ | — |
| Regression suites | 16/16 + 42/42 + 18/18 | **16/16 + 42/42 + 18/18** | — |

## Server (`server/package.json`)

| Package | Was | Now | Status | Disposition | Reason |
|---|---|---|---|---|---|
| cors | ^2.8.5 | removed | abandoned (unpublished since 2018) | **REPLACED** with ~20 lines of native middleware in `index.js` (allow-list, preflight 204, `Vary: Origin`, `Access-Control-Max-Age`) | Unmaintained, no advisories but dead code; native replacement is behavior-equivalent (verified live: pentest-live 18/18) and removes a dependency. |
| express | ^4.21.0 (resolved 4.22.2) | ^5.2.1 | current (5.x is the maintained major) | **UPGRADED** | 4.x carries repeated past CVEs (e.g. body-parser <1.20.6 low advisory found in audit). Express 5 is stable; our 5 routes + middleware needed zero code changes (verified: verify.mjs 946/954 identical, eslint clean). |
| express-rate-limit | ^7.5.1 | ^8.6.1 | current | **UPGRADED** | Required to track Express 5; API change applied: `max` → `limit`, `legacyHeaders` removed in `rateLimit.js` (all 4 limiters). Limits unchanged (register 5/hr, sync 120/min, csp 60/min, health 60/min). |
| pino | ^9.14.0 | ^10.3.1 | current | **UPGRADED** | Backward-compatible transport API; `logger.js` untouched. |

**Retained as-is**: none on the server — all four remaining packages are current.

### better-sqlite3 — deliberately retained at ^12.11.1

- `13.0.2` (released 2026-07-29) ships **no prebuilt binaries** (empty GitHub release assets) — installing it requires a local C++ toolchain (node-gyp) and risks build failure in deploy pipelines (Render).
- 12.x is actively maintained, has prebuilds, has **no known advisories**, and satisfies our usage (WAL, Proxy-cached writes in `store.js`).
- Re-evaluate 13.x once prebuilds ship; upgrade is a drop-in at that point.

## Client (`client/package.json`)

### Runtime dependencies

| Package | Was | Now | Status | Disposition | Reason |
|---|---|---|---|---|---|
| jsondiffpatch | ^0.6.2 | ^0.7.6 | current | **UPGRADED** | 0.6.2 flagged in npm audit (GHSA-33vc-wfww-vjfv, moderate, jsondiffpatch <0.7.2). 0.7.x is a rewritten patch pipeline with hardening (malformed-delta/infinite-loop fixes). **Behavior verified identical**: client pentest suite re-run on 0.7.6 → 16/16 PASS, incl. C4 (malformed deltas throw & are caught) and C5 (deep-nesting DoS guarded). |
| react / react-dom | ^18.3.1 | ^19.2.8 | current | **UPGRADED** | React 18 maintenance ended 2025. 19.x is the only maintained major. Code audited for React-19 breakage (no `ReactDOM.render`, `findDOMNode`, defaultProps, legacy lifecycles) — zero changes needed; build + tests green. |
| @types/react / @types/react-dom | ^18.3.12 / ^18.3.1 | ^19.2.18 / ^19.2.4 | current | **UPGRADED** | Matches React 19. |

### Development dependencies

| Package | Was | Now | Status | Disposition | Reason |
|---|---|---|---|---|---|
| typescript | ~5.6.2 | ~5.9.2 (resolved 5.9.3) | current JS-based line | **UPGRADED** | npm latest is 7.0.2, the Go-native rewrite (tsgo) — deliberately not adopted. 5.9 brought stricter `BufferSource` typing (`Uint8Array<ArrayBuffer>` generic); required a 3-line type fix in `encrypt.ts`, `keychain.ts`, `sync.worker.ts` (runtime behavior unchanged). |
| vite | ^6.0.0 | ^7.0.0 (resolved 7.3.6) | mature line | **UPGRADED** | Latest is 8.2.0 but requires `@vitejs/plugin-react` 6.x (rolldown-based, young). Vite 7 + plugin-react 5.x is the mature pairing (plugin-react 5.x peer range vite ^4–^7). Build: 2.2s, unchanged structure. |
| @vitejs/plugin-react | ^4.3.4 | ^5.0.0 (resolved 5.2.0) | current | **UPGRADED** | Companion to Vite 7. |
| vite-plugin-pwa | ^1.3.0 | ^1.3.0 | current | **RETAINED** | Latest release; peerDeps support vite ^3–^8. Zero advisories. |
| workbox-core / workbox-precaching | ^7.4.1 | ^7.4.1 | current | **RETAINED** | Required by vite-plugin-pwa's injectManifest; resolved 7.4.1 deduped under it (`npm ls` clean). No newer major exists. |

### Transitive advisories fixed (via `npm audit fix`, no code impact)

- `brace-expansion` (high) — resolved by patched transitive version
- `fast-uri` (high) — resolved by patched transitive version
- `postcss` (high, ≤8.5.17) — resolved by patched transitive version
- `jsondiffpatch` (moderate, GHSA-33vc-wfww-vjfv) — resolved by direct upgrade to 0.7.6

## Bundle impact (client production build)

| Chunk | Before | After | Delta |
|---|---|---|---|
| index (main) | 225.53 kB / gzip 66.74 | 273.96 kB / gzip 80.47 | **+48.43 kB / +13.73 kB gzip** |
| engine (lazy) | 28.53 kB | 30.68 kB | +2.15 kB |
| sync.worker | 15.62 kB | 18.41 kB | +2.79 kB |
| editor (lazy) | 11.10 kB | 11.37 kB | +0.27 kB |
| encrypt (lazy) | 0.83 kB | 0.83 kB | 0 |
| keychain (lazy) | 2.25 kB | 2.06 kB | −0.19 kB |
| sw.js | — | 17.27 kB | precache 17 entries, 1895.71 KiB |

The main-chunk increase is React 19's runtime (new internals, compiler runtime); lazy chunks (engine, editor, encrypt, keychain, worker) stay split out of the critical path per the bundle budget. React 19's size is the accepted cost of being on the only maintained React major.

## Verification matrix (all green after changes)

- `client/`: `npm run build` (tsc -b + vite build) ✓ — 0 TS errors, 0 vite errors
- `server/`: `npx eslint .` ✓
- `server/scripts/verify.mjs`: 946/954 — same 8 pre-existing failures (S08, S10, S13, S14, S16–S19), zero new failures
- `server/scripts/pentest-core.mjs`: 42/42 ✓
- `server/scripts/pentest-live.mjs` (against restarted live instance on :3001): 18/18 ✓ — native CORS is behavior-equivalent
- `client/scripts/pentest-client.mjs` (on jsondiffpatch 0.7.6): 16/16 PASS, 23 INFO ✓
- `npm audit` (both): 0 vulnerabilities ✓
- `npm ls` (both): no duplicates, no invalid/overlapping packages ✓

## Held upgrades (deliberate)

| Package | Latest | Why held |
|---|---|---|
| better-sqlite3 | 13.0.2 | No prebuilt binaries; would force local C++ compile in deploy. Re-evaluate when prebuilds ship. |
| vite + @vitejs/plugin-react | 8.2.0 / 6.0.5 | Plugin-react 6 is rolldown-based (young); vite 7 + plugin-react 5 is the mature line. Re-evaluate after ecosystem settles. |
| typescript | 7.0.2 (tsgo) | Go-native rewrite, breaking ecosystem shifts; 5.9.x is the current stable JS-based line. |
