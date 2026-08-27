import { performance } from "node:perf_hooks";
import { spawn, execSync } from "node:child_process";
import { cpSync, readdirSync, existsSync, rmSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PORT = 3901;
const BASE = `http://127.0.0.1:${PORT}`;
const CONTENT = "x".repeat(5000);
const DEVICES = 5;
const FILES = 100;
const DELTA_EDIT = 20;
const DELTA_ADD = 300;
const METADATA = 50;
const PULLS = 20;
const HISTORY = 10;
const DELETES = 10;
const TAG = process.argv[2] || "baseline";

const workDir = join(tmpdir(), `textpad-bench-${process.pid}`);
rmSync(workDir, { recursive: true, force: true });
mkdirSync(workDir, { recursive: true });

for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
  if (entry.name === "node_modules" || entry.name === "data" || entry.name === "scripts" || entry.name === "prof" || entry.name === "eslint.config.js" || entry.name === "package-lock.json") continue;
  cpSync(join(ROOT, entry.name), join(workDir, entry.name), { recursive: true });
}
if (existsSync(join(ROOT, "node_modules"))) {
  execSync(`cmd /c mklink /J "${join(workDir, "node_modules")}" "${join(ROOT, "node_modules")}"`, { stdio: "ignore" });
}

const profDir = join(workDir, "prof");
mkdirSync(profDir, { recursive: true });

const child = spawn(process.execPath, ["index.js"], {
  cwd: workDir,
  env: { ...process.env, PORT: String(PORT), TRUST_PROXY: "0", LOG_LEVEL: "silent", API_SECRET: "bench-secret" },
  stdio: ["ignore", "pipe", "pipe"],
});

const latencies = {};
const bytesBy = {};
let requests = 0;
const reqMs = (label) => {
  const t0 = performance.now();
  return {
    label,
    done(bytes) {
      const ms = performance.now() - t0;
      (latencies[label] ||= []).push(ms);
      (bytesBy[label] ||= []).push(bytes);
      requests++;
    },
  };
};

async function waitReady() {
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("server did not start");
}

async function register(deviceLabel, groupId) {
  const r = reqMs("register");
  const res = await fetch(`${BASE}/api/sync/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceLabel, groupId }),
  });
  const data = await res.json();
  r.done(Buffer.byteLength(JSON.stringify(data)));
  return data;
}

async function syncOps(device, ops, gzip = false) {
  const r = reqMs("sync-batch");
  const headers = { "Content-Type": "application/json", "X-Device-Id": device.deviceId, Authorization: `Bearer ${device.sessionToken}` };
  if (gzip) headers["Accept-Encoding"] = "gzip";
  const res = await fetch(`${BASE}/api/sync`, { method: "POST", headers, body: JSON.stringify({ ops }) });
  const buf = Buffer.from(await res.arrayBuffer());
  r.done(buf.length);
  return JSON.parse(buf.toString());
}

async function getList(device, gzip = false) {
  const r = reqMs("sync-list");
  const headers = { "X-Device-Id": device.deviceId, Authorization: `Bearer ${device.sessionToken}` };
  if (gzip) headers["Accept-Encoding"] = "gzip";
  const res = await fetch(`${BASE}/api/sync`, { headers });
  const buf = Buffer.from(await res.arrayBuffer());
  r.done(buf.length);
  return JSON.parse(buf.toString());
}

async function getHistory(device, fileId, since, gzip = false) {
  const r = reqMs("sync-history");
  const headers = { "X-Device-Id": device.deviceId, Authorization: `Bearer ${device.sessionToken}` };
  if (gzip) headers["Accept-Encoding"] = "gzip";
  const res = await fetch(`${BASE}/api/sync/${fileId}?since=${since}`, { headers });
  const buf = Buffer.from(await res.arrayBuffer());
  r.done(buf.length);
  return JSON.parse(buf.toString());
}

async function deleteFile(device, fileId) {
  const r = reqMs("sync-delete");
  const res = await fetch(`${BASE}/api/sync/${fileId}`, { method: "DELETE", headers: { "X-Device-Id": device.deviceId, Authorization: `Bearer ${device.sessionToken}` } });
  r.done(0);
  return res.status;
}

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function percentileStats(list) {
  if (list.length === 0) return { n: 0 };
  const s = [...list].sort((a, b) => a - b);
  return { n: s.length, p50: pct(s, 50), p90: pct(s, 90), p95: pct(s, 95), p99: pct(s, 99), max: s[s.length - 1] };
}

async function main() {
  await waitReady();
  const t0 = performance.now();

  const devices = [];
  for (let d = 0; d < DEVICES; d++) {
    devices.push(await register(`bench-${d}`, "bench-group"));
  }

  for (let d = 0; d < DEVICES; d++) {
    const ops = [];
    for (let i = 0; i < FILES; i++) {
      ops.push({ fileId: `f${d}-${String(i).padStart(4, "0")}`, type: "snapshot", baseVersion: 0, patch: CONTENT, name: `doc-${i}.txt`, timestamp: Date.now() });
    }
    await syncOps(devices[d], ops);
  }

  const versions = new Map();
  for (let d = 0; d < DEVICES; d++) for (let i = 0; i < FILES; i++) versions.set(`f${d}-${String(i).padStart(4, "0")}`, 1);

  for (let round = 0; round < 3; round++) {
    for (let d = 0; d < DEVICES; d++) {
      const ops = [];
      for (let i = 0; i < DELTA_EDIT; i++) {
        const id = `f${d}-${String(i * 3).padStart(4, "0")}`;
        ops.push({ fileId: id, type: "delta", baseVersion: versions.get(id), patch: `p${round}-${"y".repeat(DELTA_ADD)}`, timestamp: Date.now() });
        versions.set(id, versions.get(id) + 1);
      }
      await syncOps(devices[d], ops);
    }
  }

  for (let d = 0; d < DEVICES; d++) {
    const ops = [];
    for (let i = 0; i < METADATA; i++) {
      ops.push({ fileId: `f${d}-${String(i).padStart(4, "0")}`, type: "metadata", baseVersion: versions.get(`f${d}-${String(i).padStart(4, "0")}`), name: `renamed-${i}.md`, timestamp: Date.now() });
    }
    await syncOps(devices[d], ops);
  }

  for (let p = 0; p < PULLS; p++) {
    await getList(devices[p % DEVICES], p % 2 === 1);
  }
  for (let d = 0; d < DEVICES; d++) {
    for (let i = 0; i < HISTORY; i++) {
      await getHistory(devices[d], `f${d}-${String(i * 7).padStart(4, "0")}`, 1, i % 2 === 1);
    }
  }
  for (let d = 0; d < DEVICES; d++) {
    for (let i = 0; i < DELETES; i++) {
      await deleteFile(devices[d], `f${d}-${String(i).padStart(4, "0")}`);
    }
  }

  const elapsed = performance.now() - t0;
  const rssMB = Math.round(Number(execSync(`powershell -NoProfile -Command "(Get-Process -Id ${child.pid}).WorkingSet64"`).toString()) / 1024 / 1024);

  const dbPath = join(workDir, "data", "textpad.db");
  const db = new Database(dbPath, { readonly: true });
  const counts = {
    devices: db.prepare("SELECT count(*) AS n FROM devices").get().n,
    files: db.prepare("SELECT count(*) AS n FROM files").get().n,
    versions: db.prepare("SELECT count(*) AS n FROM file_versions").get().n,
  };
  const dbBytes = statSync(dbPath).size + (existsSync(dbPath + "-wal") ? statSync(dbPath + "-wal").size : 0);
  db.close();

  child.kill();

  const summary = {
    tag: TAG,
    elapsedMs: Math.round(elapsed * 10) / 10,
    requests,
    requestsPerSec: Math.round((requests / (elapsed / 1000)) * 10) / 10,
    latency: Object.fromEntries(Object.entries(latencies).map(([k, v]) => [k, percentileStats(v)])),
    bytes: Object.fromEntries(Object.entries(bytesBy).map(([k, v]) => [k, { total: v.reduce((a, b) => a + b, 0), avg: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 }])),
    counts,
    dbBytes,
    rssMB,
  };
  console.log(JSON.stringify(summary, null, 2));
  writeFileSync(join(__dirname, "prof", `${TAG}.json`), JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  child.kill();
  process.exit(1);
});
