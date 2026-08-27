import { chromium } from "playwright";
import { spawn } from "node:child_process";

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const dev = spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--port", "5173", "--strictPort"], { cwd: process.cwd(), stdio: "ignore" });
for (let i = 0; i < 100; i++) {
  try {
    const r = await fetch("http://localhost:5173/");
    if (r.status < 500) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 200));
}
const b = await chromium.launch();
const p = await (await b.newContext()).newPage();
p.on("console", (m) => log("[console]", m.text().slice(0, 400)));
p.on("pageerror", (e) => log("[pageerror]", String(e).slice(0, 300)));
await p.goto("http://localhost:5173/?perf=1");
await p.waitForTimeout(2500);
const r = await p.evaluate(async () => {
  const w = new Worker("/src/workers/sync.worker.ts", { type: "module" });
  const call = (type, payload) =>
    new Promise((resolve, reject) => {
      const id = Math.floor(Math.random() * 1e9);
      const handler = (e) => {
        if (e.data?.id !== id) return;
        w.removeEventListener("message", handler);
        if (e.data.result && typeof e.data.result === "object" && "error" in e.data.result) reject(new Error(e.data.result.error));
        else resolve(e.data.result);
      };
      w.addEventListener("message", handler);
      w.postMessage({ id, type, payload });
    });
  const a = "line one\nline two\n" + "x".repeat(500000) + "\nend";
  const b2 = "line one\nline two changed\n" + "x".repeat(500000) + "\nend revised";
  const delta = await call("COMPUTE_PATCH", { previous: a, current: b2 });
  const patched = await call("APPLY_PATCH", { base: a, delta });
  return {
    deltaIsArray: Array.isArray(delta),
    deltaJsonLen: JSON.stringify(delta).length,
    patchedType: typeof patched,
    patchedLen: typeof patched === "string" ? patched.length : -1,
    expectedLen: b2.length,
    equal: patched === b2,
    head: typeof patched === "string" ? patched.slice(0, 60) : null,
    tail: typeof patched === "string" ? patched.slice(-30) : null,
  };
});
log("RESULT:", JSON.stringify(r));
await b.close();
dev.kill();
