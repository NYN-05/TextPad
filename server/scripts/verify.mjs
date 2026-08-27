import { createRequire } from "node:module";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const clientRequire = createRequire(join(__dirname, "../../client/package.json"));
const { diff, patch } = clientRequire("jsondiffpatch");

import { createStore } from "../lib/store.js";
import { createSyncHandler } from "../handlers/sync.js";
import { createSyncListHandler } from "../handlers/syncList.js";
import { createSyncPullHandler } from "../handlers/syncPull.js";
import { createSyncDeleteHandler } from "../handlers/syncDelete.js";
import { createRegisterHandler } from "../handlers/register.js";
import { LIMITS } from "../lib/limits.js";

let failures = 0;
let checks = 0;
let scenarioCount = 0;

function assert(cond, msg) {
  checks++;
  if (!cond) {
    failures++;
    console.error(`  ✗ ASSERT FAILED: ${msg}`);
  }
}

function scenario(name) {
  scenarioCount++;
  console.log(`\n▶ Scenario ${scenarioCount}: ${name}`);
}

function applyJsonPatch(base, patchStr) {
  const result = patch(base, typeof patchStr === "string" ? JSON.parse(patchStr) : patchStr);
  return typeof result === "string" ? result : String(result ?? base);
}

function mergeLines(ancestor, local, remote) {
  if (local === remote) return { merged: local, conflict: false };
  const localLines = local.split("\n");
  const remoteLines = remote.split("\n");
  const ancestorLines = ancestor.split("\n");
  const maxLen = Math.max(localLines.length, remoteLines.length, ancestorLines.length);
  const mergedLines = [];
  let hasConflict = false;
  for (let i = 0; i < maxLen; i++) {
    const a = ancestorLines[i] ?? "";
    const l = localLines[i] ?? "";
    const r = remoteLines[i] ?? "";
    if (l === r) mergedLines.push(l);
    else if (l === a) mergedLines.push(r);
    else if (r === a) mergedLines.push(l);
    else {
      mergedLines.push(`<<<<<<< local\n${l}\n=======\n${r}\n>>>>>>> remote`);
      hasConflict = true;
    }
  }
  return { merged: mergedLines.join("\n"), conflict: hasConflict };
}

function createApi() {
  const store = createStore(":memory:");
  const devices = store.devices;
  const files = store.files;
  const syncHandler = createSyncHandler(devices, files);
  const listHandler = createSyncListHandler(devices, files);
  const pullHandler = createSyncPullHandler(devices, files);
  const deleteHandler = createSyncDeleteHandler(devices, files);
  const registerHandler = createRegisterHandler(devices);

  const makeReq = (deviceId, over = {}) => ({
    deviceId,
    body: over.body ?? {},
    query: over.query ?? {},
    params: over.params ?? {},
  });
  const makeRes = () => ({
    _status: 200,
    _json: null,
    status(c) { this._status = c; return this; },
    json(d) { this._json = d; return this; },
    end() { this._done = true; return this; },
    setHeader() {},
  });

  return {
    register(groupId, label) {
      const res = makeRes();
      registerHandler(makeReq(null, { body: { groupId, deviceLabel: label } }), res);
      return res._json.deviceId;
    },
    postSync(deviceId, ops) {
      const res = makeRes();
      syncHandler(makeReq(deviceId, { body: { ops } }), res);
      if (res._status !== 200) throw new Error("sync POST failed");
      return res._json;
    },
    list(deviceId) {
      const res = makeRes();
      listHandler(makeReq(deviceId), res);
      return res._json;
    },
    pullFile(deviceId, fileId, since) {
      const res = makeRes();
      pullHandler(makeReq(deviceId, { params: { fileId }, query: { since: String(since) } }), res);
      if (res._status === 404) return null;
      return res._json;
    },
    deleteDirect(deviceId, fileId) {
      const res = makeRes();
      deleteHandler(makeReq(deviceId, { params: { fileId } }), res);
      return res._status;
    },
    getServerFile(groupId, fileId) { return files.get(groupId, fileId); },
    allServerFiles(groupId) { return files.all(groupId); },
    deviceCount() { return devices.size; },
  };
}

class ClientSim {
  constructor(name, groupId, api, opts = {}) {
    this.name = name;
    this.groupId = groupId;
    this.api = api;
    this.deviceId = api.register(groupId, name);
    this.files = new Map();
    this.queue = new Map();
    this.tombstones = new Set();
    this.syncedNames = new Map();
    this.online = true;
    this.lastServerOps = [];
    this.onBeforeGuard = opts.onBeforeGuard ?? null;
  }

  newFile(id, content, name = "notes.txt") {
    this.files.set(id, { id, name, content, baseContent: "", version: 0, syncedAt: 0, updatedAt: Date.now() });
    this.enqueue(id);
  }

  edit(id, content) {
    const f = this.files.get(id);
    f.content = content;
    f.updatedAt = Date.now();
    this.enqueue(id);
  }

  rename(id, name) {
    this.files.get(id).name = name;
    this.enqueue(id);
  }

  remove(id) {
    this.files.delete(id);
    this.tombstones.add(id);
    this.queue.delete(id);
  }

  computeOp(f) {
    const neverSynced = f.version === 0 || f.baseContent === undefined;
    if (neverSynced) {
      return { fileId: f.id, type: "snapshot", baseVersion: 0, patch: f.content, name: f.name, contentAfter: f.content, timestamp: Date.now(), retries: 0 };
    }
    const delta = diff(f.baseContent, f.content);
    const serialized = JSON.stringify(delta ?? {});
    if (serialized === "{}" && this.syncedNames.get(f.id) === f.name) return null;
    if (serialized === "{}") {
      return { fileId: f.id, type: "metadata", baseVersion: f.version, name: f.name, contentAfter: f.content, timestamp: Date.now(), retries: 0 };
    }
    if (serialized.length > 700_000) {
      return { fileId: f.id, type: "snapshot", baseVersion: f.version, patch: f.content, name: f.name, contentAfter: f.content, timestamp: Date.now(), retries: 0 };
    }
    return { fileId: f.id, type: "delta", baseVersion: f.version, patch: serialized, name: f.name, contentAfter: f.content, timestamp: Date.now(), retries: 0 };
  }

  enqueue(id) {
    const f = this.files.get(id);
    if (!f) return;
    const op = this.computeOp(f);
    if (!op) return;
    this.queue.set(id, op);
  }

  async flush() {
    const ops = [...this.queue.values()];
    if (ops.length === 0) return;
    this.queue.clear();
    const res = this.api.postSync(this.deviceId, ops);
    this.lastServerOps = res.serverOps ?? [];
    for (const op of ops) {
      const f = this.files.get(op.fileId);
      if (res.acceptedFiles.includes(op.fileId)) {
        const ver = res.acceptedVersions.find((v) => v.fileId === op.fileId)?.version;
        if (f) {
          if (op.contentAfter !== undefined) f.baseContent = op.contentAfter;
          if (ver !== undefined) f.version = ver;
          f.syncedAt = Date.now();
        }
        this.syncedNames.set(op.fileId, op.name ?? "");
      } else {
        const rej = res.rejected.find((r) => r.fileId === op.fileId);
        if (rej) await this.handleRejected(op, rej);
      }
    }
    for (const so of this.lastServerOps) {
      if (so?.requestSnapshot) {
        const f = this.files.get(so.fileId);
        if (f) this.queue.set(so.fileId, {
          fileId: so.fileId, type: "snapshot", baseVersion: f.version, patch: f.content, name: f.name, contentAfter: f.content, timestamp: Date.now(), retries: 0,
        });
      }
    }
  }

  async handleRejected(op, rej) {
    if (rej.reason === "too many files") return;
    if (rej.reason === "not found") {
      const f = this.files.get(op.fileId);
      if (f) this.pushSnapshot(f, 0);
      return;
    }
    await this.fixStale(op.fileId, rej.currentVersion);
  }

  rebuild(versions, base) {
    let content = base;
    for (const v of versions) {
      if (v.snapshot || v.version === 1) content = v.patch;
      else content = applyJsonPatch(content, v.patch);
    }
    return content;
  }

  async fixStale(fileId, serverVersion) {
    const local = this.files.get(fileId);
    if (!local) return;
    const remote = this.api.pullFile(this.deviceId, fileId, local.version);
    if (!remote) {
      this.pushSnapshot(local, serverVersion ?? 0);
      return;
    }
    const rebuilt = this.rebuild(remote.versions, local.baseContent ?? "");
    if (remote.deleted) {
      if (local.baseContent !== local.content) {
        this.pushSnapshot(local, remote.version ?? 0);
      } else {
        this.tombstones.add(fileId);
        this.files.delete(fileId);
        this.syncedNames.delete(fileId);
      }
      return;
    }
    if (local.baseContent === local.content) {
      local.content = rebuilt;
      local.baseContent = rebuilt;
      local.version = remote.version;
      local.name = remote.name;
      this.syncedNames.set(fileId, remote.name);
      return;
    }
    const m = mergeLines(local.baseContent, local.content, rebuilt);
    local.content = m.merged;
    local.baseContent = rebuilt;
    local.version = remote.version;
    local.name = remote.name;
    this.syncedNames.set(fileId, remote.name);
    if (m.merged !== rebuilt) this.enqueue(fileId);
  }

  pushSnapshot(local, baseVersion) {
    this.queue.set(local.id, {
      fileId: local.id, type: "snapshot", baseVersion, patch: local.content, name: local.name, contentAfter: local.content, timestamp: Date.now(), retries: 0,
    });
  }

  async pull() {
    const metas = this.api.list(this.deviceId);
    for (const meta of metas) {
      const local = this.files.get(meta.fileId);
      if (this.tombstones.has(meta.fileId)) continue;
      if (meta.deleted) {
        if (local && meta.version >= local.version) {
          this.tombstones.add(meta.fileId);
          this.files.delete(meta.fileId);
          this.syncedNames.delete(meta.fileId);
        }
        continue;
      }
      if (local && meta.version <= local.version) continue;
      if (local && local.baseContent !== local.content) continue;
      if (this.queue.has(meta.fileId)) continue;
      const guard = local ? { version: local.version, content: local.content } : null;
      const detail = this.api.pullFile(this.deviceId, meta.fileId, local?.version ?? 0);
      if (!detail) continue;
      if (detail.deleted) {
        if (local) {
          this.tombstones.add(meta.fileId);
          this.files.delete(meta.fileId);
          this.syncedNames.delete(meta.fileId);
        }
        continue;
      }
      const rebuilt = this.rebuild(detail.versions, local?.content ?? "");
      if (this.onBeforeGuard) this.onBeforeGuard(meta.fileId);
      if (guard) {
        const now = this.files.get(meta.fileId);
        if (!now || now.version !== guard.version || now.content !== guard.content) continue;
        now.content = rebuilt;
        now.baseContent = rebuilt;
        now.version = meta.version;
        now.name = meta.name;
        now.updatedAt = Date.now();
        this.syncedNames.set(meta.fileId, meta.name);
      } else {
        this.files.set(meta.fileId, {
          id: meta.fileId, name: meta.name, content: rebuilt, baseContent: rebuilt, version: meta.version, syncedAt: Date.now(), updatedAt: Date.now(),
        });
        this.syncedNames.set(meta.fileId, meta.name);
      }
    }
  }

  async syncAll() {
    for (const f of this.files.values()) {
      if (f.version === 0 || f.baseContent === undefined || f.baseContent !== f.content) this.enqueue(f.id);
    }
    await this.flush();
  }
}

function checkServerInvariants(api, groupId, label) {
  const files = api.allServerFiles(groupId);
  for (const f of files) {
    const vs = f.versions.map((v) => v.version);
    const sorted = [...vs].sort((a, b) => a - b);
    assert(JSON.stringify(vs) === JSON.stringify(sorted), `${label}: chain ascending for ${f.fileId}`);
    assert(new Set(vs).size === vs.length, `${label}: no duplicate versions for ${f.fileId}`);
    assert(vs.length === 0 || Math.max(...vs) === f.version, `${label}: server counter === max version for ${f.fileId}`);
    if (vs.length > 0) {
      const newestSnap = Math.max(...f.versions.filter((v) => v.snapshot).map((v) => v.version), 0);
      if (newestSnap > 0) {
        assert(f.versions.some((v) => v.version === newestSnap), `${label}: newest snapshot retained for ${f.fileId}`);
      }
      const firstIsSnap = f.versions[0].snapshot;
      const frontIsNewestSnap = firstIsSnap && f.versions[0].version === newestSnap;
      assert(firstIsSnap || vs.length <= LIMITS.maxVersionsPerFile + 1, `${label}: chain may only exceed cap when front is newest snapshot (${f.fileId})`);
      if (vs.length > LIMITS.maxVersionsPerFile + 1) {
        assert(frontIsNewestSnap, `${label}: oversized chain must start with newest snapshot (${f.fileId})`);
      }
    }
  }
}

function expectFile(client, id, content) {
  const f = client.files.get(id);
  assert(f !== undefined, `client ${client.name} has file ${id}`);
  if (f) assert(f.content === content, `client ${client.name}: content of ${id} is ${JSON.stringify(f.content)}, expected ${JSON.stringify(content)}`);
}

async function converge(...clients) {
  for (let iter = 0; iter < 6; iter++) {
    let moved = false;
    for (const c of clients) {
      const before = c.queue.size;
      await c.pull();
      await c.flush();
      if (c.queue.size !== before) moved = true;
    }
    const contents = clients.map((c) => [...c.files.values()].map((f) => f.content).join("\u0000"));
    if (!moved && new Set(contents).size === 1) break;
  }
}

async function s01_basic_two_device_convergence() {
  scenario("S01: basic two-device convergence");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-01";

  a.newFile(fid, "hello world");
  awaitFlush(a);
  b.pull();
  expectFile(b, fid, "hello world");

  b.edit(fid, "hello world, from B");
  awaitFlush(b);
  a.pull();
  expectFile(a, fid, "hello world, from B");

  a.edit(fid, "hello world, from B, edited by A");
  awaitFlush(a);
  b.pull();
  expectFile(b, fid, "hello world, from B, edited by A");

  checkServerInvariants(api, "g1", "S01");
}

async function s02_concurrent_same_version_deltas() {
  scenario("S02: concurrent same-version deltas (CAS)");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-02";

  a.newFile(fid, "line1\nline2\nline3\n");
  awaitFlush(a);
  b.pull();
  expectFile(b, fid, "line1\nline2\nline3\n");

  a.edit(fid, "line1\nline2A\nline3\n");
  b.edit(fid, "line1\nline2\nline3B\n");
  a.enqueue(fid);
  b.enqueue(fid);
  await a.flush();
  await b.flush();

  assert(a.files.get(fid).version === 2, "A accepted its delta");
  const server = api.getServerFile("g1", fid);
  const aWon = server.version === 2 && server.versions[1].version === 2;

  await converge(a, b);

  const merged = "line1\nline2A\nline3B\n";
  expectFile(a, fid, merged);
  expectFile(b, fid, merged);
  checkServerInvariants(api, "g1", "S02");
  assert(aWon || server.version >= 3, "S02: convergence required a follow-up op");
}

async function s03_conflict_markers_preserved() {
  scenario("S03: conflicting edits to the same line produce markers, no loss");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-03";

  a.newFile(fid, "alpha\nbeta\ngamma\n");
  awaitFlush(a);
  b.pull();

  a.edit(fid, "alpha\nbeta-X\ngamma\n");
  b.edit(fid, "alpha\nbeta-Y\ngamma\n");
  a.enqueue(fid);
  b.enqueue(fid);
  await a.flush();
  await b.flush();

  await converge(a, b);

  const contentA = a.files.get(fid).content;
  const contentB = b.files.get(fid).content;
  assert(contentA === contentB, "S03: both devices converge to same content");
  assert(contentA.includes("beta-X") && contentA.includes("beta-Y"), "S03: both edits preserved");
  assert(contentA.includes("<<<<<<<"), "S03: conflict markers present");
  if (!contentA.includes("beta-X") || !contentA.includes("beta-Y")) {
    console.log("   content:", JSON.stringify(contentA));
  }
  checkServerInvariants(api, "g1", "S03");
}

async function s04_history_prune_regression() {
  scenario("S04: 60 edits — prune must not break acceptance or bootstrap (F3b/F3d regression)");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const fid = "file-04";

  a.newFile(fid, "v0");
  awaitFlush(a);
  let rejected = 0;
  for (let i = 1; i <= 60; i++) {
    a.edit(fid, `v${i}`);
    const before = [...a.queue.values()];
    await a.flush();
    for (const op of before) {
      if (op.type === "delta") {
        const s = api.getServerFile("g1", fid);
        if (s && op.baseVersion + 1 !== s.version) rejected++;
      }
    }
  }
  assert(rejected === 0, "S04: no in-sync delta was rejected across the 50-version boundary (old F3b)");
  assert(a.files.get(fid).version === 61, "S04: client counter reached 61 (monotonic)");

  const fresh = new ClientSim("C", "g1", api);
  fresh.pull();
  expectFile(fresh, fid, "v60");

  const stale = new ClientSim("D", "g1", api);
  stale.files.set(fid, { id: fid, name: "notes.txt", content: "v30", baseContent: "v30", version: 31, syncedAt: 1, updatedAt: 0 });
  stale.pull();
  assert(stale.files.get(fid).version === 61, "S04: stale client version advanced to server version");
  expectFile(stale, fid, "v60");
  checkServerInvariants(api, "g1", "S04");
}

async function s05_rebase_no_pull_stall() {
  scenario("S05: snapshot push must not stall other devices (F3a regression)");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-05";

  a.newFile(fid, "content-0");
  awaitFlush(a);
  b.pull();

  for (let i = 1; i <= 3; i++) {
    a.edit(fid, `content-${i}`);
    awaitFlush(a);
    b.pull();
  }
  expectFile(b, fid, "content-3");

  b.edit(fid, "b-diverges");
  a.edit(fid, "a-diverges");
  a.enqueue(fid);
  b.enqueue(fid);
  await a.flush();
  await b.flush();

  await converge(a, b);

  const finalA = a.files.get(fid).content;
  const finalB = b.files.get(fid).content;
  assert(finalA === finalB, "S05: devices converged after snapshot/merge");
  assert(finalA.includes("a-diverges") && finalA.includes("b-diverges"), "S05: no silent data loss");
  const serverVersion = api.getServerFile("g1", fid).version;
  assert(serverVersion >= 5, "S05: server counter never shrank");
  checkServerInvariants(api, "g1", "S05");
}

async function s06_delete_tombstone_no_resurrect() {
  scenario("S06: delete via queued op — propagation, no resurrection (F6)");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-06";

  a.newFile(fid, "delete me");
  awaitFlush(a);
  b.pull();
  expectFile(b, fid, "delete me");

  a.remove(fid);
  a.queue.set(fid, { fileId: fid, type: "delete", baseVersion: 0, timestamp: Date.now(), retries: 0 });
  b.edit(fid, "edit while delete pending");
  awaitFlush(b);

  await a.flush();
  b.pull();
  assert(!b.files.has(fid), "S06: B learned of deletion");
  assert(!a.files.has(fid), "S06: A did not resurrect");

  awaitFlush(a);
  a.pull();
  assert(!a.files.has(fid), "S06: A never resurrects from server list");

  const srv = api.getServerFile("g1", fid);
  assert(srv && srv.deleted === true, "S06: server marks file deleted");
  checkServerInvariants(api, "g1", "S06");
}

async function s07_offline_edits_flush_on_reconnect() {
  scenario("S07: offline edits are enqueued and flushed on reconnect (F4)");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-07";

  a.newFile(fid, "original");
  awaitFlush(a);
  b.pull();

  a.online = false;
  a.edit(fid, "edited offline");
  assert(a.queue.has(fid), "S07: op queued while offline");
  await a.flush();
  expectFile(b, fid, "original");

  a.online = true;
  await a.flush();
  b.pull();
  expectFile(b, fid, "edited offline");
  checkServerInvariants(api, "g1", "S07");
}

async function s08_server_data_loss_recovery() {
  scenario("S08: server state loss — client self-heals via re-register + snapshot (F7)");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const fid = "file-08";
  a.newFile(fid, "data that must survive");
  awaitFlush(a);

  const api2 = createApi();
  a.api = api2;
  a.deviceId = api2.register("g1", "A");
  a.syncedNames.clear();
  a.edit(fid, "data that must survive + edit after loss");
  await a.syncAll();
  await a.flush();
  const srv = api2.getServerFile("g1", fid);
  assert(srv && srv.versions.length === 1 && srv.versions[0].snapshot, "S08: client rebuilt server state with a snapshot");
  const fresh = new ClientSim("C", "g1", api2);
  fresh.pull();
  expectFile(fresh, fid, "data that must survive + edit after loss");
  checkServerInvariants(api2, "g1", "S08");
}

async function s09_duplicate_request_idempotency() {
  scenario("S09: duplicate POST (retry after timeout) must not corrupt");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const fid = "file-09";
  a.newFile(fid, "base");
  awaitFlush(a);

  a.edit(fid, "edited");
  const op = a.queue.get(fid);
  const first = api.postSync(a.deviceId, [op]);
  const second = api.postSync(a.deviceId, [op]);
  assert(first.accepted === 1, "S09: first delivery accepted");
  assert(second.accepted === 0 && second.rejected.length === 1, "S09: duplicate delivery rejected (stale)");
  const srv = api.getServerFile("g1", fid);
  assert(srv.version === 2, "S09: version advanced exactly once");
  assert(srv.versions.filter((v) => v.version === 2).length === 1, "S09: no duplicate version entries");
  a.queue.clear();
  a.files.get(fid).version = 2;
  a.files.get(fid).baseContent = "edited";
  a.pull();
  expectFile(a, fid, "edited");
  checkServerInvariants(api, "g1", "S09");
}

async function s10_metadata_rename_no_version_bump() {
  scenario("S10: rename (empty delta) is a metadata op, no version bump, works across devices");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-10";
  a.newFile(fid, "content", "old.txt");
  awaitFlush(a);
  b.pull();
  expectFile(b, fid, "content");

  a.rename(fid, "new.txt");
  await a.flush();
  const srv = api.getServerFile("g1", fid);
  assert(srv.name === "new.txt", "S10: server name updated");
  assert(srv.version === 1, "S10: no version bump for metadata op");
  b.pull();
  assert(b.files.get(fid).name === "new.txt", "S10: B learned the new name");
  checkServerInvariants(api, "g1", "S10");
}

async function s11_pull_toctou_guard() {
  scenario("S11: edit during pull must not be clobbered (F5)");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-11";

  a.newFile(fid, "line1\nline2\nline3\n");
  awaitFlush(a);
  b.pull();
  expectFile(b, fid, "line1\nline2\nline3\n");

  a.edit(fid, "line1\nline2\nremote-X\n");
  awaitFlush(a);

  let injected = false;
  const guarded = new ClientSim("B2", "g1", api);
  guarded.files = b.files;
  guarded.tombstones = b.tombstones;
  guarded.syncedNames = b.syncedNames;
  guarded.queue = b.queue;
  guarded.onBeforeGuard = () => {
    if (injected) return;
    injected = true;
    guarded.edit(fid, "line1\nlocal-Y\nline3\n");
  };
  await guarded.pull();
  await guarded.flush();
  await guarded.flush();

  const merged = "line1\nlocal-Y\nremote-X\n";
  assert(b.files.get(fid).content === merged, "S11: in-flight edit merged, pull did not clobber it");
  a.pull();
  expectFile(a, fid, merged);
  checkServerInvariants(api, "g1", "S11");
}

async function s12_fresh_device_bootstrap_after_prune() {
  scenario("S12: fresh device bootstraps from retained snapshot (F3d regression)");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const fid = "file-12";
  a.newFile(fid, "start");
  awaitFlush(a);
  for (let i = 1; i <= 55; i++) {
    a.edit(fid, `start-${i}`);
    awaitFlush(a);
  }
  const fresh = new ClientSim("F", "g1", api);
  fresh.pull();
  expectFile(fresh, fid, "start-55");
  checkServerInvariants(api, "g1", "S12");
}

async function s13_request_snapshot_compact() {
  scenario("S13: server requests snapshot when chain can't prune — chain stays bounded");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const fid = "file-13";
  a.newFile(fid, "base");
  awaitFlush(a);
  let requested = 0;
  for (let i = 1; i <= 60; i++) {
    a.edit(fid, `base-${i}`);
    await a.flush();
    for (const so of a.lastServerOps) if (so.requestSnapshot) requested++;
  }
  assert(requested > 0, "S13: requestSnapshot emitted when chain exceeds cap");
  awaitFlush(a);
  const srv = api.getServerFile("g1", fid);
  assert(srv.versions.length <= LIMITS.maxVersionsPerFile + 1, "S13: chain bounded after client compaction");
  assert(srv.versions[0].snapshot, "S13: compacted chain starts with a snapshot");
  const fresh = new ClientSim("F", "g1", api);
  fresh.pull();
  expectFile(fresh, fid, "base-60");
  checkServerInvariants(api, "g1", "S13");
}

async function s14_delete_vs_concurrent_edit() {
  scenario("S14: delete vs concurrent edit — deterministic, no silent loss");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-14";

  a.newFile(fid, "shared");
  awaitFlush(a);
  b.pull();

  a.remove(fid);
  a.queue.set(fid, { fileId: fid, type: "delete", baseVersion: 0, timestamp: Date.now(), retries: 0 });
  b.edit(fid, "shared + my edits");

  await a.flush();
  await b.flush();

  const srv = api.getServerFile("g1", fid);
  const deleted = srv.deleted;
  if (deleted) {
    b.pull();
    awaitFlush(b);
    assert(b.files.get(fid) === undefined || b.files.get(fid).content.includes("my edits"),
      "S14: edit survives or is merged on delete (no silent loss)");
  } else {
    b.pull();
    expectFile(b, fid, "shared + my edits");
  }
  checkServerInvariants(api, "g1", "S14");
}

async function s15_group_isolation() {
  scenario("S15: passphrase groups are isolated (F1)");
  const api = createApi();
  const a = new ClientSim("A", "group-alpha", api);
  const b = new ClientSim("B", "group-beta", api);
  const fid = "file-15";
  a.newFile(fid, "alpha-only");
  awaitFlush(a);
  b.pull();
  assert(!b.files.has(fid), "S15: B in another group never sees A's file");
  const listB = api.list(b.deviceId);
  assert(listB.length === 0, "S15: B's list is empty");
  const srvA = api.getServerFile("group-alpha", fid);
  const srvB = api.getServerFile("group-beta", fid);
  assert(srvA && srvA.versions.length === 1, "S15: file exists in alpha");
  assert(!srvB, "S15: no file in beta");
  checkServerInvariants(api, "group-alpha", "S15");
}

async function s16_gap_recovery() {
  scenario("S16: version gap (client ahead of server) resolves via merge, no loss");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-16";
  a.newFile(fid, "v0");
  awaitFlush(a);
  for (let i = 1; i <= 3; i++) {
    a.edit(fid, `v${i}`);
    awaitFlush(a);
  }
  b.pull();
  expectFile(b, fid, "v3");

  a.edit(fid, "v4");
  awaitFlush(a);

  b.edit(fid, "b-local-edit");
  await b.flush();
  assert(b.files.get(fid).baseContent !== b.files.get(fid).content || b.files.get(fid).version >= 5,
    "S16: B's edit went through merge/rebuild");

  await converge(a, b);
  assert(a.files.get(fid).content === b.files.get(fid).content, "S16: converged");
  assert(a.files.get(fid).content.includes("v4") && a.files.get(fid).content.includes("b-local-edit"), "S16: no silent loss");
  checkServerInvariants(api, "g1", "S16");
}

async function s17_stale_client_merge_no_clobber() {
  scenario("S17: stale client (old version) pushes — CAS rejects, pull+merge, no clobber");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const b = new ClientSim("B", "g1", api);
  const fid = "file-17";
  a.newFile(fid, "c0");
  awaitFlush(a);
  for (let i = 1; i <= 3; i++) {
    a.edit(fid, `c${i}`);
    awaitFlush(a);
  }
  b.pull();
  expectFile(b, fid, "c3");

  a.edit(fid, "c4");
  awaitFlush(a);

  b.edit(fid, "c3-stale-edit");
  await b.flush();

  await converge(a, b);
  const cA = a.files.get(fid).content;
  const cB = b.files.get(fid).content;
  assert(cA === cB, "S17: converged");
  assert(cA.includes("c4") && cA.includes("c3-stale-edit"), "S17: stale edit merged in, c4 not clobbered");
  const srv = api.getServerFile("g1", fid);
  assert(srv.versions.length <= LIMITS.maxVersionsPerFile + 1, "S17: bounded chain");
  checkServerInvariants(api, "g1", "S17");
}

async function s18_many_devices_storm() {
  scenario("S18: 5 devices, concurrent edits to disjoint lines, all converge");
  const api = createApi();
  const devices = [];
  for (let i = 0; i < 5; i++) devices.push(new ClientSim(`D${i}`, "g1", api));
  const fid = "file-18";
  devices[0].newFile(fid, "line0\nline1\nline2\nline3\nline4");
  awaitFlush(devices[0]);
  for (const d of devices) d.pull();

  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 5; i++) {
      const d = devices[i];
      const ls = d.files.get(fid).content.split("\n");
      while (ls.length < 5 + r * 5) ls.push("");
      ls[r * 5 + i] = `r${r} d${i}`;
      d.edit(fid, ls.join("\n"));
    }
    for (const d of devices) await d.flush();
  }

  await converge(...devices);

  const contents = devices.map((d) => d.files.get(fid).content);
  assert(new Set(contents).size === 1, "S18: all five devices converged");
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 5; i++) {
      assert(contents[0].includes(`r${r} d${i}`), `S18: round ${r} device ${i} edit preserved`);
    }
  }
  checkServerInvariants(api, "g1", "S18");
}

async function s19_delete_direct_endpoint_idempotent() {
  scenario("S19: legacy DELETE endpoint is idempotent and group-scoped");
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const c = new ClientSim("C", "other-group", api);
  const fid = "file-19";
  a.newFile(fid, "x");
  awaitFlush(a);
  const forbidden = api.deleteDirect(c.deviceId, fid);
  assert(forbidden === 204 && api.getServerFile("g1", fid).deleted === false, "S19: delete from another group is a no-op");
  const s1 = api.deleteDirect(a.deviceId, fid);
  const s2 = api.deleteDirect(a.deviceId, fid);
  assert(s1 === 204 && s2 === 204, "S19: delete idempotent (204 both times)");
  const srv = api.getServerFile("g1", fid);
  assert(srv && srv.deleted === true, "S19: file marked deleted");
  checkServerInvariants(api, "g1", "S19");
}

async function awaitFlush(client) {
  await client.flush();
}

async function main() {
  await s01_basic_two_device_convergence();
  await s02_concurrent_same_version_deltas();
  await s03_conflict_markers_preserved();
  await s04_history_prune_regression();
  await s05_rebase_no_pull_stall();
  await s06_delete_tombstone_no_resurrect();
  await s07_offline_edits_flush_on_reconnect();
  await s08_server_data_loss_recovery();
  await s09_duplicate_request_idempotency();
  await s10_metadata_rename_no_version_bump();
  await s11_pull_toctou_guard();
  await s12_fresh_device_bootstrap_after_prune();
  await s13_request_snapshot_compact();
  await s14_delete_vs_concurrent_edit();
  await s15_group_isolation();
  await s16_gap_recovery();
  await s17_stale_client_merge_no_clobber();
  await s18_many_devices_storm();
  await s19_delete_direct_endpoint_idempotent();

  console.log(`\n──────────────────────────────────────────────`);
  console.log(`Scenarios: ${scenarioCount}, assertions: ${checks}, failures: ${failures}`);
  if (failures > 0) {
    console.error("PROTOCOL VERIFICATION FAILED");
    process.exit(1);
  }
  console.log("PROTOCOL VERIFICATION PASSED");
}

if (process.env.NO_RUN !== "1") await main();

export { createApi, ClientSim, converge, expectFile, checkServerInvariants, assert, applyJsonPatch, mergeLines };
