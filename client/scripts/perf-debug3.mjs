import { chromium } from "playwright";
import { spawn } from "node:child_process";

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
await p.goto("http://localhost:5173/?perf=1");
await p.waitForTimeout(2000);
const r = await p.evaluate(async () => {
  const mod = await import("/node_modules/.vite/deps/jsondiffpatch.js");
  const a = "line one\nline two\n" + "x".repeat(50) + "\nend";
  const b2 = "line one\nline two changed\n" + "x".repeat(50) + "\nend revised";
  const d1 = mod.diff(a, b2);
  const src = 'onmessage = (e) => { postMessage({ type: "RESULT", result: e.data.delta }); };';
  const w = new Worker(URL.createObjectURL(new Blob([src], { type: "text/javascript" })));
  const back = await new Promise((res, rej) => {
    w.onmessage = (e) => res(e.data.result);
    w.onerror = () => rej(new Error("worker err"));
    w.postMessage({ delta: d1 });
  });
  const p1 = mod.patch(a, d1);
  const p2 = mod.patch(a, back);
  return {
    pageDiffIsArray: Array.isArray(d1),
    roundTripIsArray: Array.isArray(back),
    pagePatchOk: p1 === b2,
    roundTripPatchOk: p2 === b2,
    keyInfo: JSON.stringify(d1).slice(0, 60),
  };
});
console.log("RESULT:", JSON.stringify(r));
await b.close();
dev.kill();
