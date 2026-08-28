# Contributing to TextPad

## Getting Started

Install dependencies separately:

```sh
cd server && npm install
cd ../client && npm install
```

Start server + client in two terminals:

```sh
# Terminal 1
cd server && node index.js

# Terminal 2
cd client && npx vite --port 5173
```

Root has no `package.json` — there is no single `npm run dev`.

## Code Style

### TypeScript / React (client)

- **No code comments** — the codebase avoids inline comments. Code should be self-documenting.
- **Plain CSS** — each component has a corresponding file in `client/src/styles/` (13 files). No Tailwind, no CSS-in-JS, no shadcn.
- **No global state library** — `useFileStore` is the single source of truth for file state.
- **No router** — view switching uses a `ViewState` union type in `App.tsx`.
- **Imports**: extensionless (`"./db"`, not `"./db.ts"`).
- TypeScript strict mode is enabled. `noUnusedLocals` and `noUnusedParameters` are disabled.
- Editor component is lazy-loaded: `React.lazy(() => import("./components/Editor"))` with manual chunk `editor`.

### JavaScript / Express (server)

- **ESM only** — `"type": "module"` in package.json. All imports use `.js` extensions (`"./store.js"`).
- **No build step** — raw ESM, run directly with `node index.js`.
- **Logging** — use pino (`server/lib/logger.js`), not `console.log`. Exceptions: startup messages and auth code.
- ESLint config at `server/eslint.config.js`.

## Commands

| Command | Location | Description |
|---------|----------|-------------|
| `npm run build` | client/ | `tsc -b && vite build` (both must pass) |
| `npm run server` | server/ | `node index.js` |
| `npm run client` | client/ | `vite --port 5173` |

## Pull Request Process

1. Run `npm run build` in `client/` — TypeScript and Vite build must both pass with zero errors.
2. Verify the server starts without errors: `node server/index.js`.
3. Keep PRs focused on a single concern. Avoid mixing refactors with feature work.
4. No tests exist in this repo. If adding tests, place them adjacent to the source file.

## Architecture Notes

Key design decisions to be aware of before making changes:

- **Sync system**: The `SyncEngine` class (`sync/engine.ts`) handles all server communication via `init()`, `syncAll()`, `enqueue(file)`, `flush()` (batched ≤100 ops, 3s debounce), `pull()` (staleness-cached 5 min), `flushBeacon()` (sendBeacon), `deleteFile()`. Legacy `sync.ts` has been removed; no legacy CRUD — sync API only.
- **Encryption degradation**: If `crypto.subtle` is unavailable, content is stored as cleartext. `encryptContent`/`decryptContent` in `db.ts` handle this transparently.
- **Autosave**: 500ms debounce (not per-keystroke). Editor also has a separate 400ms debounce before calling the autosave handler. Two-tier debouncing is intentional.
- **Existing files never overwritten**: `pull()` checks local versions first — if local files are current, server data is not imported.
- **No git repo**: Initialize with `git init` before making commits.
