# TextPad API Reference

> Express 4 ESM server. All endpoints are prefixed with `/api`.

## Authentication

HMAC-SHA256 token scheme. No user accounts or passwords.

1. Call `POST /api/sync/register` to get `{ deviceId, sessionToken }` **once per browser** (the client persists these in IndexedDB and reuses them forever).
2. Send them on every subsequent request — **as headers**:
   - `X-Device-Id: <deviceId>`
   - `Authorization: Bearer <sessionToken>`
3. `POST /api/sync` also accepts them in the JSON body (`deviceId`, `sessionToken`) — this is the fallback used by `navigator.sendBeacon`, which cannot set custom headers.
4. Token = `base64(HMAC-SHA256(API_SECRET, deviceId))` — verified via `crypto.timingSafeEqual`.

## Rate Limiting

All limiters skip localhost (127.0.0.1, ::1).

| Endpoint | Window | Max |
|---|---|---|
| `POST /api/sync/register` | 1 hour | 5 |
| All `/api/sync*` routes | 1 minute | 120 |

---

## `POST /api/sync/register`

Register a new device and obtain session credentials.

**Auth:** None

### Request body

```json
{ "deviceLabel": "TextPad Browser" }
```

`deviceLabel` — string, max 128 chars (optional, defaults to `"Unnamed Device"`).

### Response `201`

```json
{
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "sessionToken": "aBcDeFgHiJkLmNoPqRsT...==",
  "expiresAt": 1722384000000
}
```

### Errors

| Status | Body |
|--------|------|
| `400` | `{ "error": "deviceLabel too long" }` |
| `429` | `{ "error": "too many registration attempts" }` |

---

## `POST /api/sync`

Delta sync — send batched operations. The server **stores opaque payloads only**; it never reads, decrypts, or processes content.

**Auth:** Required (headers, or `deviceId` + `sessionToken` in body)

### Request body

```json
{
  "ops": [
    {
      "fileId": "660e8400-e29b-41d4-a716-446655440001",
      "version": 1,
      "patch": "~enc~c2VjcmV0...:aXZlY2lwaGVy",
      "name": "notes.txt",
      "base": true,
      "timestamp": 1722384000000
    }
  ]
}
```

#### `ops[]` item fields

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| `fileId` | string | max 64 chars | File identifier |
| `version` | number | >= 1 | Expected next version number |
| `patch` | string | max 1,000,000 chars | AES-256-GCM encrypted jsondiffpatch delta (or encrypted full content for `base` ops) |
| `name` | string | max 128 chars, optional | File name (stored/updated) |
| `base` | boolean | optional | `true` = replace version history with a fresh full-content snapshot (version 1) |
| `timestamp` | number | ms, optional | Operation timestamp |

`"{}"` patches are treated as **metadata-only** (name update) — no version is appended.

Unexpected keys in ops items are rejected with `400`.

### Response `200`

```json
{
  "accepted": 1,
  "acceptedFiles": ["660e8400-e29b-41d4-a716-446655440001"],
  "rejected": [{ "fileId": "...", "reason": "stale version" }],
  "serverOps": [],
  "truncatedHistory": false,
  "serverTime": 1722384000123
}
```

| Field | Type | Description |
|-------|------|-------------|
| `accepted` | number | Ops successfully applied |
| `acceptedFiles` | string[] | fileIds applied (client acknowledges + advances local versions) |
| `rejected` | array | Rejected ops with reason (`stale version`, `version gap`, `too many files`) |
| `serverOps` | array | Server-initiated notices (e.g., version truncation) |
| `truncatedHistory` | boolean | True if old versions were pruned |
| `serverTime` | number | Server clock timestamp |

### Server-side op processing

| Condition | Result |
|-----------|--------|
| New file (fileId unknown) | Created with version 1, `accepted` |
| `base: true` | History replaced with a single version-1 snapshot |
| `patch === "{}"` (metadata) | Name updated, no version appended |
| Version matches expected (`versions.length + 1`) | Appended, `accepted` |
| Version <= current length | `rejected`, `"stale version"` (client responds with a `base` re-sync) |
| Version > expected + 1 | `rejected`, `"version gap"` |
| Device exceeds 1000 files | `rejected`, `"too many files"` |
| File exceeds 50 versions | Oldest pruned, `serverOp` returned |

### Errors

| Status | Body |
|--------|------|
| `400` | `{ "error": "..." }` (validation) |
| `401` | `{ "error": "unauthorized" }` or `{ "error": "device not registered" }` |
| `415` | `{ "error": "unsupported media type, expected application/json" }` |
| `429` | `{ "error": "too many requests" }` |

---

## `GET /api/sync`

List the device's files (metadata only — **no content, no patches**).

**Auth:** Required (headers)

**Response `200`** — with `Cache-Control: private, max-age=30`

```json
[
  {
    "fileId": "660e8400-...",
    "name": "notes.txt",
    "version": 5,
    "createdAt": 1722384000000,
    "updatedAt": 1722384000000
  }
]
```

The client compares `version` against its local versions and pulls only divergent files.

---

## `GET /api/sync/:fileId?since=N`

Fetch version history for one file, starting after version `N` (`since=0` returns everything, including the version-1 full-content snapshot).

**Auth:** Required (headers) — the file must belong to the requesting device.

**Response `200`**

```json
{
  "name": "notes.txt",
  "createdAt": 1722384000000,
  "updatedAt": 1722384000000,
  "versions": [
    { "version": 6, "patch": "~enc~...", "timestamp": 1722384000000 }
  ]
}
```

Patches are opaque encrypted payloads — the client decrypts and applies them locally.

**Error `404`:** unknown file, or the file does not belong to this device.

---

## `DELETE /api/sync/:fileId`

Delete a file and its version history.

**Auth:** Required (headers)

**Response `204`** — no body. **Error `404`:** `{ "error": "not found" }`.

---

## `GET /api/health`

Server health and stats (useful for Render uptime monitoring).

**Auth:** None

```json
{
  "status": "ok",
  "uptime": 1234567,
  "deviceCount": 3,
  "fileCount": 42,
  "memoryUsageMB": 28
}
```

---

## `POST /api/csp-report`

CSP violation reports endpoint. Accepts CSP report objects and logs them via pino at `warn` level. **Response `204`.**

---

## Error Response Format

All errors follow `{ "error": "message" }`.

| Status | Meaning |
|--------|---------|
| `400` | Validation error |
| `401` | Authentication failure |
| `404` | Resource not found |
| `415` | Non-JSON content-type on POST/PUT/PATCH |
| `429` | Rate limit exceeded |
| `500` | Internal server error (message redacted) |
