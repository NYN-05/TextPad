import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

function freePort(port) {
  try {
    execSync(
      `powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"`,
      { stdio: "ignore" }
    );
  } catch {}
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const VITE = join(ROOT, "node_modules", "vite", "bin", "vite.js");
const PREVIEW_PORT = 4173;
const DEV_PORT = 5173;
const PREVIEW_URL = `http://localhost:${PREVIEW_PORT}/?perf=1`;
const DEV_URL = `http://localhost:${DEV_PORT}/?perf=1`;
const TAG = process.argv[2] || "baseline";
const MODE = process.argv[3] || "all";
const SEED_FILES = 500;
const SEED_SIZE = 10000;
const BIG_FILE = 2 * 1024 * 1024;

function startVite(port) {
  const child = spawn(process.execPath, [VITE, "preview", "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  return child;
}

function startDev(port) {
  const child = spawn(process.execPath, [VITE, "--port", String(port), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  return child;
}

async function waitHttp(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`server did not start: ${url}`);
}

async function seedFiles(page, n, size) {
  return page.evaluate(
    async ({ n, size }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("textpad", 5);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const t0 = performance.now();
      const tx = db.transaction("files", "readwrite");
      const store = tx.objectStore("files");
      const now = Date.now() - n * 1000;
      for (let i = 0; i < n; i++) {
        store.put({
          id: `seed-${String(i).padStart(5, "0")}`,
          name: `seed-${i}.txt`,
          content: "line one\nline two\n" + "x".repeat(Math.max(0, size - 46)) + `\nend ${i}`,
          createdAt: now + i * 1000,
          updatedAt: now + i * 1000,
          syncedAt: 0,
          version: 0,
          baseContent: "",
        });
      }
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
      return Math.round(performance.now() - t0);
    },
    { n, size }
  );
}

async function seedBigFile(page, id, size) {
  return page.evaluate(
    async ({ id, size }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("textpad", 5);
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const tx = db.transaction("files", "readwrite");
      const store = tx.objectStore("files");
      store.put({
        id,
        name: "big-file.txt",
        content: "line one\nline two\n" + "x".repeat(Math.max(0, size - 46)),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        syncedAt: 0,
        version: 0,
        baseContent: "",
      });
      await new Promise((res, rej) => {
        tx.oncomplete = res;
        tx.onerror = () => rej(tx.error);
        tx.onabort = () => rej(tx.error);
      });
    },
    { id, size }
  );
}

function injectProbes(page) {
  return page.addInitScript(() => {
    window.__longtasks = [];
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) window.__longtasks.push({ start: Math.round(e.startTime), dur: Math.round(e.duration) });
      }).observe({ entryTypes: ["longtask"] });
    } catch {}
    window.__marks = [];
    window.__mark = (n) => window.__marks.push({ n, t: performance.now() });
  });
}

async function landAndStart(page) {
  await page.getByRole("button", { name: /get started/i }).first().click();
  await page.locator(".dash-hero").waitFor({ timeout: 30000 });
}

async function gotoDashboard(page, url) {
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem("textpad-onboarding-completed", "1"));
  await landAndStart(page);
}

async function runStartup() {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await injectProbes(page);
  await page.goto(PREVIEW_URL);
  await page.evaluate(() => localStorage.setItem("textpad-onboarding-completed", "1"));
  const seedMs = await seedFiles(page, SEED_FILES, SEED_SIZE);
  const t0 = Date.now();
  await page.reload();
  await landAndStart(page);
  const t1 = Date.now();
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const fcp = performance.getEntriesByType("paint").find((e) => e.name === "first-contentful-paint");
    return {
      domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
      loadEndMs: Math.round(nav.loadEventEnd - nav.startTime),
      fcpMs: fcp ? Math.round(fcp.startTime) : null,
      longtasks: window.__longtasks,
      heapMB: Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1024 / 1024),
    };
  });
  const result = {
    seedMs,
    wallTimeToDashboardMs: t1 - t0,
    ...metrics,
  };
  await b.close();
  return result;
}

async function runTyping() {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await injectProbes(page);
  await gotoDashboard(page, DEV_URL);
  await seedFiles(page, SEED_FILES, SEED_SIZE);
  await page.reload();
  await landAndStart(page);

  await page.locator(".dash-recent-item").first().click();
  await page.locator(".editor-area").waitFor({ timeout: 10000 });
  await page.evaluate(() => { window.__typingT0 = performance.now(); });
  await page.locator(".editor-area").fill("");
  await page.locator(".editor-area").type("abcdefghijklmnopqrstuvwxyz0123456789abcdefghijklmnopqrstuvwxyz0123", { delay: 0 });
  await page.waitForTimeout(500);
  const small = await page.evaluate(() => ({
    wallMs: Math.round((performance.now() - window.__typingT0) * 10) / 10,
    stats: window.__textpadPerf.stats,
    longtasks: window.__longtasks.slice(),
  }));

  await page.evaluate(() => window.__longtasks.splice(0));
  await page.evaluate(() => window.__textpadPerf.reset());
  await seedBigFile(page, "seed-big-1", BIG_FILE);
  await page.reload();
  await landAndStart(page);
  await page.locator(".dash-recent-item", { hasText: "big-file.txt" }).click();
  await page.locator(".editor-area").waitFor({ timeout: 10000 });
  await page.locator(".editor-area").fill("");
  await page.evaluate(() => { window.__typingT0 = performance.now(); });
  await page.locator(".editor-area").type("hello world big file typing test abcdefghijklmnopqrstuvwxyz", { delay: 0 });
  await page.waitForTimeout(500);
  const big = await page.evaluate(() => ({
    wallMs: Math.round((performance.now() - window.__typingT0) * 10) / 10,
    stats: window.__textpadPerf.stats,
    longtasks: window.__longtasks.slice(),
  }));

  const crypto = await page.evaluate(async () => {
    const { encryptContent, decryptContent } = window.__textpadCrypto;
    const payload = "y".repeat(100000);
    let t0 = performance.now();
    for (let i = 0; i < 10; i++) await encryptContent(payload, "crypto-bench");
    const encMs = Math.round((performance.now() - t0) * 10) / 10;
    const cipher = await encryptContent(payload, "crypto-bench");
    t0 = performance.now();
    for (let i = 0; i < 10; i++) await decryptContent(cipher, "crypto-bench");
    const decMs = Math.round((performance.now() - t0) * 10) / 10;
    return { encMs, decMs };
  });

  await b.close();
  return { small, big, crypto };
}

async function runSearch() {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await injectProbes(page);
  await gotoDashboard(page, DEV_URL);
  await seedFiles(page, SEED_FILES, SEED_SIZE);
  await page.reload();
  await landAndStart(page);
  await page.keyboard.press("Control+f");
  await page.locator(".search-overlay").waitFor({ timeout: 5000 });
  await page.locator(".search-mode-btn", { hasText: "Content" }).click();
  await page.evaluate(() => { window.__typingT0 = performance.now(); });
  await page.locator(".search-input").type("end 499", { delay: 0 });
  await page.locator(".search-result-item").first().waitFor({ timeout: 10000 });
  const t1 = await page.evaluate(() => Math.round((performance.now() - window.__typingT0) * 10) / 10);
  const metrics = await page.evaluate(() => ({
    results: document.querySelectorAll(".search-result-item").length,
    longtasks: window.__longtasks.slice(),
  }));
  await b.close();
  return { timeToFirstResultMs: t1, ...metrics };
}

async function runIdb() {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await gotoDashboard(page, DEV_URL);
  await seedFiles(page, SEED_FILES, SEED_SIZE);
  const result = await page.evaluate(async ({ n }) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("textpad", 5);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const blob = "q".repeat(10000);
    const putOne = () => new Promise((res, rej) => {
      const tx = db.transaction("files", "readwrite");
      tx.objectStore("files").put({ id: `idb-${Math.random()}`, name: "t.txt", content: blob, createdAt: 1, updatedAt: 1, syncedAt: 0, version: 0 });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
    let t0 = performance.now();
    for (let i = 0; i < n; i++) await putOne();
    const putMs = Math.round((performance.now() - t0) * 10) / 10;
    const getOne = (id) => new Promise((res, rej) => {
      const r = db.transaction("files", "readonly").objectStore("files").get(id);
      r.onsuccess = () => res();
      r.onerror = () => rej(r.error);
    });
    t0 = performance.now();
    for (let i = 0; i < n; i++) await getOne(`seed-${String(i).padStart(5, "0")}`);
    const getMs = Math.round((performance.now() - t0) * 10) / 10;
    t0 = performance.now();
    const all = await new Promise((res, rej) => {
      const r = db.transaction("files", "readonly").objectStore("files").getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const getAllMs = Math.round((performance.now() - t0) * 10) / 10;
    return { putMs, getMs, getAllMs, rows: all.length };
  }, { n: 200 });
  await b.close();
  return result;
}

async function runWorker() {
  const b = await chromium.launch();
  const ctx = await b.newContext();
  const page = await ctx.newPage();
  await page.goto(DEV_URL);
  await page.waitForTimeout(2500);
  const result = await page.evaluate(async () => {
    const w = new Worker("/src/workers/sync.worker.ts", { type: "module" });
    const call = (type, payload) => new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1e9);
      const timer = setTimeout(() => reject(new Error(`worker ${type} timeout`)), 30000);
      const handler = (e) => {
        if (e.data?.id !== id) return;
        w.removeEventListener("message", handler);
        clearTimeout(timer);
        const r = e.data.result;
        if (r && typeof r === "object" && "error" in r) reject(new Error(r.error));
        else if (type === "COMPUTE_PATCH") resolve(r?.delta);
        else if (type === "APPLY_PATCH") resolve(r?.result);
        else resolve(r);
      };
      w.addEventListener("message", handler);
      w.postMessage({ id, type, payload });
    });
    const a = "line one\nline two\n" + "x".repeat(500000) + "\nend";
    const b = "line one\nline two changed\n" + "x".repeat(500000) + "\nend revised";
    let t0 = performance.now();
    const delta = await call("COMPUTE_PATCH", { previous: a, current: b });
    const diffMs = Math.round((performance.now() - t0) * 10) / 10;
    t0 = performance.now();
    const patched = await call("APPLY_PATCH", { base: a, delta });
    const applyMs = Math.round((performance.now() - t0) * 10) / 10;
    const ok = patched === b;
    t0 = performance.now();
    await call("MERGE", { ancestor: a, local: b, remote: a });
    const mergeMs = Math.round((performance.now() - t0) * 10) / 10;
    w.terminate();
    return { diffMs, applyMs, mergeMs, ok, sizeMB: a.length / 1024 / 1024 };
  });
  await b.close();
  return result;
}

freePort(PREVIEW_PORT);
freePort(DEV_PORT);
const preview = startVite(PREVIEW_PORT);
const dev = startDev(DEV_PORT);
const results = { tag: TAG };

try {
  await waitHttp(PREVIEW_URL.split("?")[0]);
  await waitHttp(DEV_URL.split("?")[0]);
  if (MODE === "all" || MODE === "startup") results.startup = await runStartup();
  if (MODE === "all" || MODE === "typing") results.typing = await runTyping();
  if (MODE === "all" || MODE === "search") results.search = await runSearch();
  if (MODE === "all" || MODE === "idb") results.idb = await runIdb();
  if (MODE === "all" || MODE === "worker") results.worker = await runWorker();
  console.log(JSON.stringify(results, null, 2));
  mkdirSync(join(__dirname, "prof"), { recursive: true });
  writeFileSync(join(__dirname, "prof", `${TAG}.json`), JSON.stringify(results, null, 2));
} finally {
  preview.kill();
  dev.kill();
}
