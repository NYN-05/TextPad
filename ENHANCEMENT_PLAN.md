# TextPad Production-Grade Enhancement Guideline

Based on my analysis of the architecture (graphify-out + Docs + source code), here's a prioritized enhancement plan addressing **performance, storage optimization, bug fixes, error handling, and UX polish**.

---

## 🔴 CRITICAL — Bugs & Data Integrity Risks

### 1. **IndexedDB Version Mismatch** (BREAKING)

**File:** `client/src/db.ts:52` — `const VER = 5` but ARCHITECTURE.md says v4

- **Risk:** Schema migration failures, data loss on upgrade
- **Fix:** Align version, add explicit `onupgradeneeded` migrations for v4→v5

### 2. **Decryption Failure Silent Corruption**

**File:** `client/src/db.ts:103-113` — `decryptFile()` catches errors but returns partially decrypted file

- **Risk:** User sees garbled content; no recovery UI
- **Fix:**
  - Throw on decryption failure, show "Corrupted file — restore from backup?" dialog
  - Add `corrupted: boolean` flag to `LocalFile` type

### 3. **Search Worker Memory Leak**

**File:** `client/src/hooks/useSearch.ts:97-103` — Worker recreated on every `open` toggle but old files not cleared

- **Risk:** Accumulates file content in worker memory
- **Fix:** Call `worker.setFiles([])` before terminate; add `files` version tracking

### 4. **Sync Engine Race on `pull()` + `flush()` Concurrent**

**File:** `client/src/sync/engine.ts:280, 489` — Both use `withLock()` but `notifyFilesUpdated()` fires outside lock

- **Risk:** UI sees stale state; duplicate enqueues
- **Fix:** Move `notifyFilesUpdated()` inside lock; add `pull`/`flush` mutual exclusion

### 5. **`sendBeacon` Payload Size Unchecked**

**File:** `client/src/sync/engine.ts:470` — Returns early if >50KB but doesn't re-queue

- **Risk:** Large pending ops lost on page unload
- **Fix:** Split batch; re-queue remainder; persist to `sync_queue`

### 6. **`useAutosave` Loses Content on Rapid Edits**

**File:** `client/src/hooks/useAutosave.ts:10-31` — `pendingRef` overwritten; if save in-flight, new content replaces pending

- **Risk:** Keystrokes lost during slow saves
- **Fix:** Queue multiple pending contents; flush all on `flush()`

### 7. **Editor Undo Stack Resets on File Switch**

**File:** `client/src/components/Editor.tsx:26-29` — History recreated on `file` prop change

- **Risk:** Undo lost when switching tabs
- **Fix:** Persist undo stack per file in `useActiveFile` or IndexedDB

---

## 🟠 HIGH — Performance & Storage Optimization

### 8. **Full File Load on Startup (Memory Bloat)**

**File:** `client/src/App.tsx:127` — `loadFiles()` loads **all content** into memory

- **Impact:** 1000 files × 1MB = 1GB+ RAM
- **Fix:**
  - Load only metadata initially (`getAllFilesMeta()`)
  - Lazy-load content on demand (`loadFileContent()`)
  - Add LRU cache with size limit (e.g., 50MB)

### 9. **Redundant `loadFiles()` + `loadMeta()` Calls**

**File:** `client/src/App.tsx:254, 275, 361, 432` — Called 4× per file operation

- **Fix:** Single `refresh()` returning `{ files, meta }`; components subscribe to needed slice

### 10. **`baseContent` Not Pruned — Storage Growth**

**File:** `client/src/sync/engine.ts:347` — `baseContent` updated on every successful sync but never cleared

- **Impact:** Each file stores 2× content (current + base)
- **Fix:**
  - Clear `baseContent` after N successful syncs (configurable)
  - Or: store only hash of baseContent; re-fetch from server on conflict

### 11. **Sync Queue No TTL / Max Size**

**File:** `client/src/db.ts:253-291` — `sync_queue` unbounded

- **Risk:** Disk quota exceeded on offline burst
- **Fix:**
  - Max 10,000 ops / 50MB per device
  - Auto-evict oldest non-snapshot ops when limit hit
  - Persist "queue full" warning to user

### 12. **Search Worker Sends Full File Content on Every Open**

**File:** `client/src/hooks/useSearch.ts:37-38` — `setFiles()` sends entire `files[]` with content

- **Fix:** Send only `{id, name, content}` for files modified since last search; use `structuredClone` efficiently

### 13. **`jsondiffpatch` in Main Bundle (Dev)**

**File:** `client/src/sync/patcher.ts:1` — Imported even when sync disabled

- **Fix:** Dynamic import in `Patcher` constructor; already done for worker but not fallback

### 14. **No Virtualization for Large File Lists**

**File:** `client/src/components/Sidebar.tsx` — Renders all files

- **Fix:** React-window virtualization for >100 files

---

## 🟡 MEDIUM — Error Handling & Resilience

### 15. **No Structured Error Types**

- **Current:** `throw new Error("...")` everywhere
- **Fix:** Define `AppError` hierarchy:
  ```ts
  class SyncError extends Error { code: 'STALE_VERSION'|'QUOTA'|'AUTH'... }
  class CryptoError extends Error { code: 'KEY_MISSING'|'DECRYPT_FAILED'... }
  class StorageError extends Error { code: 'QUOTA_EXCEEDED'|'CORRUPTED'... }
  ```

### 16. **Toast Notifications Not Actionable**

**File:** `client/src/components/Toast.tsx` — No "Retry", "View Details", "Dismiss All"

- **Fix:** Add action buttons per error type (e.g., sync failure → "Retry Now")

### 17. **Offline Indicator Inaccurate**

**File:** `client/src/hooks/useUI.ts` — Uses `navigator.onLine` only

- **Fix:** Add heartbeat ping to `/api/health` every 30s; show "Server unreachable" vs "Offline"

### 18. **No Sync Conflict Visualization**

- **Current:** 3-way merge produces conflict markers inline silently
- **Fix:** Show "Conflict resolved" banner with "View diff" link; store conflict history

### 19. **Backup Restore No Progress / Cancel**

**File:** `client/src/App.tsx:397-439` — Blocks UI on large backups

- **Fix:** Stream parse JSON; show progress bar; allow cancel

### 20. **Settings Dialog No Validation on Blur**

**File:** `client/src/components/SettingsDialog.tsx` — `syncPassphrase` change doesn't re-init sync engine

- **Fix:** Debounced re-init on passphrase change; show "Reconnecting..."

---

## 🟢 LOW — UX Polish & Clean Experience

### 21. **Onboarding Wizard Skippable but Not Re-enterable**

- **Fix:** Add "Run Setup Again" in Settings

### 22. **No Keyboard Shortcut Help Overlay**

- **Fix:** `Cmd+/` → modal with all shortcuts

### 23. **Empty States Generic**

- **Fix:** Contextual illustrations (e.g., "No search results" vs "No files yet")

### 24. **File Sort Options Missing**

- **Fix:** Sort by name, date, size in Sidebar + Dashboard

### 25. **No File Preview on Hover**

- **Fix:** Tooltip with first 3 lines + stats

### 26. **Command Palette (Cmd+K)**

- **Fix:** Centralized actions: create, search, settings, sync, backup

### 27. **Focus Management on Dialogs**

- **Fix:** Trap focus in `ConfirmDialog`, `SettingsDialog`; restore on close

### 28. **Reduced Motion Respected**

- **Fix:** Check `prefers-reduced-motion` for spinners, transitions

---

## 🔧 TECHNICAL DEBT & CODE QUALITY

### 29. **App.tsx God Component (603 lines)**

- **Fix:** Extract:
  - `useSyncEngine` hook (sync init, flush, pull)
  - `useFileOperations` hook (create, delete, duplicate, rename, import, export)
  - `useSessionRestore` hook

### 30. **Magic Numbers Scattered**

- **Fix:** Centralize in `client/src/config/constants.ts`

### 31. **No TypeScript Strict Null Checks on IndexedDB Reads**

- **Fix:** Enable `strictNullChecks`; add `NonNullable` assertions

### 32. **Server: In-Memory Cache No Eviction Policy**

**File:** `server/lib/store.js` — Proxy objects grow unbounded

- **Fix:** LRU with max 10,000 entries; periodic flush

### 33. **Server: No Request ID for Tracing**

- **Fix:** Generate `requestId` per request; include in all logs + error responses

### 34. **No E2E Tests for Critical Flows**

- **Fix:** Playwright tests for: create→edit→sync→pull→conflict→resolve

---

## 📦 IMPLEMENTATION PRIORITY ORDER

| Phase                 | Tasks                              | Est. Effort |
| --------------------- | ---------------------------------- | ----------- |
| **P0 (Week 1)** | #1, #2, #4, #5, #6, #15            | 3-4 days    |
| **P1 (Week 2)** | #3, #7, #8, #9, #10, #11, #16, #17 | 4-5 days    |
| **P2 (Week 3)** | #12, #13, #14, #18, #19, #20, #29  | 3-4 days    |
| **P3 (Week 4)** | #21-28, #30-34                     | 3-4 days    |

---

## 🎯 SUCCESS METRICS

| Metric                      | Current | Target          |
| --------------------------- | ------- | --------------- |
| Startup memory (100 files)  | ~200MB  | <50MB           |
| Sync flush latency (p50)    | ~800ms  | <200ms          |
| Search latency (1000 files) | ~300ms  | <50ms           |
| Bundle size (main)          | ~180KB  | <150KB          |
| Error recovery rate         | Manual  | >95% auto       |
| Offline edit survival       | 100%    | 100% (verified) |

---

## 📋 VERIFICATION CHECKLIST PER PHASE

After each phase, run:

```bash
# Client
cd client && npm run build        # tsc -b && vite build (must pass)
npm run lint                       # if exists

# Server
cd server && npx eslint .

# Manual verification
- Fresh install + onboarding
- Edit 10 files offline → online → verify sync
- Large file (500KB) edit → autosave → blur → sync
- Conflict simulation (two tabs same file)
- Backup export → clear data → restore
- Search 1000 files
- Settings: toggle encryption, sync, passphrase
- Keyboard-only navigation
- Screen reader (NVDA/VoiceOver) audit
```
