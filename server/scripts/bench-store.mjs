import { performance } from "node:perf_hooks";
import { createStore } from "../lib/store.js";
import { getDatabase } from "../lib/database.js";
import { createRegisterHandler } from "../handlers/register.js";
import { createSyncHandler } from "../handlers/sync.js";
import { createSyncListHandler } from "../handlers/syncList.js";
import { createSyncPullHandler } from "../handlers/syncPull.js";
import { createSyncDeleteHandler } from "../handlers/syncDelete.js";

function mockRes() {
  const res = {
    __status: 200,
    __body: null,
    setHeader() { return this; },
    status(c) { this.__status = c; return this; },
    json(b) { this.__body = b; return this; },
    end() { return this; },
  };
  return res;
}

const CONTENT = "x".repeat(2000);
const DEVICES = 5;
const FILES = 100;
const DELTA_EDIT = 20;
const DELTA_ADD = 200;
const METADATA = 50;
const PULLS = 20;
const HISTORY = 10;
const DELETES = 10;

function fileId(device, n) {
  return `bench-${device}-${String(n).padStart(4, "0")}`;
}

function phaseStats(name, start, end, changesStart, changesEnd, ops) {
  const ms = end - start;
  console.log(
    `${name.padEnd(22)} ${String(ops).padStart(5)} ops  ${ms.toFixed(1).padStart(9)} ms  ${(ms / ops).toFixed(3).padStart(8)} ms/op  ${String(changesEnd - changesStart).padStart(7)} stmts  ${((changesEnd - changesStart) / ops).toFixed(1).padStart(7)} stmts/op`
  );
  return { name, ops, ms: Math.round(ms * 10) / 10, msPerOp: Math.round((ms / ops) * 1000) / 1000, stmts: changesEnd - changesStart, stmtsPerOp: Math.round(((changesEnd - changesStart) / ops) * 10) / 10 };
}

const store = createStore(":memory:");
const db = getDatabase(":memory:");
const devices = store.devices;
const files = store.files;
const register = createRegisterHandler(devices);
const sync = createSyncHandler(devices, files);
const list = createSyncListHandler(devices, files);
const pull = createSyncPullHandler(devices, files);
const del = createSyncDeleteHandler(devices, files);

const changes = () => db.prepare("SELECT total_changes() AS n").get().n;
const results = [];

const deviceIds = [];
for (let d = 0; d < DEVICES; d++) {
  const res = mockRes();
  register({ body: { deviceLabel: `bench-${d}`, groupId: "bench-group" } }, res);
  deviceIds.push(res.__body.deviceId);
}

let start = performance.now();
let c0 = changes();
for (let d = 0; d < DEVICES; d++) {
  const ops = [];
  for (let i = 0; i < FILES; i++) {
    ops.push({ fileId: fileId(d, i), type: "snapshot", baseVersion: 0, patch: CONTENT, name: `doc-${i}.txt`, timestamp: Date.now() });
  }
  sync({ body: { ops }, deviceId: deviceIds[d] }, mockRes());
}
results.push(phaseStats("snapshot sync", start, performance.now(), c0, changes(), DEVICES * FILES));

let versions = new Map();
for (let d = 0; d < DEVICES; d++) for (let i = 0; i < FILES; i++) versions.set(fileId(d, i), 1);

for (let round = 0; round < 3; round++) {
  start = performance.now();
  c0 = changes();
  for (let d = 0; d < DEVICES; d++) {
    const ops = [];
    for (let i = 0; i < DELTA_EDIT; i++) {
      const id = fileId(d, i * 3);
      ops.push({ fileId: id, type: "delta", baseVersion: versions.get(id), patch: `p${round}-${"y".repeat(DELTA_ADD)}`, timestamp: Date.now() });
      versions.set(id, versions.get(id) + 1);
    }
    sync({ body: { ops }, deviceId: deviceIds[d] }, mockRes());
  }
  results.push(phaseStats(`delta round ${round + 1}`, start, performance.now(), c0, changes(), DEVICES * DELTA_EDIT));
}

start = performance.now();
c0 = changes();
for (let d = 0; d < DEVICES; d++) {
  const ops = [];
  for (let i = 0; i < METADATA; i++) {
    ops.push({ fileId: fileId(d, i), type: "metadata", baseVersion: versions.get(fileId(d, i)), name: `renamed-${i}.md`, timestamp: Date.now() });
  }
  sync({ body: { ops }, deviceId: deviceIds[d] }, mockRes());
}
results.push(phaseStats("metadata renames", start, performance.now(), c0, changes(), DEVICES * METADATA));

start = performance.now();
c0 = changes();
for (let p = 0; p < PULLS; p++) {
  list({ deviceId: deviceIds[p % DEVICES] }, mockRes());
}
results.push(phaseStats("sync list pulls", start, performance.now(), c0, changes(), PULLS));

start = performance.now();
c0 = changes();
for (let d = 0; d < DEVICES; d++) {
  for (let i = 0; i < HISTORY; i++) {
    pull({ deviceId: deviceIds[d], params: { fileId: fileId(d, i * 7) }, query: { since: "1" } }, mockRes());
  }
}
results.push(phaseStats("history pulls", start, performance.now(), c0, changes(), DEVICES * HISTORY));

start = performance.now();
c0 = changes();
for (let d = 0; d < DEVICES; d++) {
  for (let i = 0; i < DELETES; i++) {
    del({ deviceId: deviceIds[d], params: { fileId: fileId(d, i) } }, mockRes());
  }
}
results.push(phaseStats("deletes", start, performance.now(), c0, changes(), DEVICES * DELETES));

const counts = {
  devices: db.prepare("SELECT count(*) AS n FROM devices").get().n,
  files: db.prepare("SELECT count(*) AS n FROM files").get().n,
  versions: db.prepare("SELECT count(*) AS n FROM file_versions").get().n,
  totalChanges: changes(),
};

console.log(JSON.stringify({ phase: results, counts }));
