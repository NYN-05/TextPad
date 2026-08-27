import { chromium } from "playwright";
import { spawn, execSync } from "node:child_process";

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function freePort(port) {
  try {
    execSync(`powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"`, { stdio: "ignore" });
  } catch {}
}

freePort(5173);
const dev = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", "5173", "--strictPort"], { cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"] });
dev.stdout.on("data", (d) => log("[vite]", d.toString().trim().slice(0, 200)));
dev.stderr.on("data", (d) => log("[vite-err]", d.toString().trim().slice(0, 200)));
log("waiting for dev server");
for (let i = 0; i < 100; i++) {
  try {
    const r = await fetch("http://localhost:5173/");
    if (r.status < 500) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
}
log("dev server ready, launching chromium");
const b = await chromium.launch();
log("chromium launched");
const p = await (await b.newContext()).newPage();
p.on("pageerror", (e) => log("[pageerror]", String(e).slice(0, 300)));
log("goto");
await p.goto("http://localhost:5173/?perf=1", { timeout: 60000 });
log("goto done, waiting 3s");
await p.waitForTimeout(3000);
log("evaluating worker");
try {
  const r = await p.evaluate(async () => {
    const w = new Worker("/src/workers/sync.worker.ts", { type: "module" });
    w.onerror = (e) => console.log("[worker-error]", e.message, e.filename);
    return await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout")), 30000);
      const h = (e) => {
        if (e.data?.type === "RESULT") {
          clearTimeout(t);
          res("worker responded");
        }
      };
      w.addEventListener("message", h);
      w.postMessage({ id: 1, type: "COMPUTE_PATCH", payload: { previous: "a".repeat(1000), current: "b".repeat(1000) } });
    });
  });
  log("worker eval:", r);
} catch (e) {
  log("worker eval failed:", String(e).slice(0, 300));
}
await b.close();
dev.kill();
