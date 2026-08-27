import { patch } from "jsondiffpatch";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const cjs = (file) => {
  const src = join(here, `.compiled/sync/${file}.js`);
  const dst = join(here, `.compiled/sync/${file}.cjs`);
  let code = readFileSync(src, "utf8");
  code = code.replace(/require\("\.\/([a-z-]+)"\)/g, 'require("./$1.cjs")');
  writeFileSync(dst, code);
  return dst;
};
cjs("delta-sanitize");
const { Patcher } = require(cjs("patcher"));
const { sanitizeDelta } = require(cjs("delta-sanitize"));

const b64 = (s) => Buffer.from(s, "base64").toString("utf8");
const [mode, baseJson, deltaJson] = process.argv.slice(2);
const base = JSON.parse(b64(baseJson));
const delta = JSON.parse(b64(deltaJson));

const pollution = () => ({
  proto: ({}).polluted !== undefined,
  ctor: ({}).constructor?.polluted !== undefined,
  deepCtor: ({}).constructor?.constructor?.polluted !== undefined,
  protoType: Object.prototype.polluted !== undefined,
  targetProto: base && typeof base === "object" ? Object.getPrototypeOf(base)?.polluted !== undefined : false,
});

let out;
try {
  if (mode === "raw") {
    const result = patch(base, delta);
    out = { pollution: pollution(), resultType: typeof result, result };
  } else if (mode === "sanitized") {
    const result = patch(base, sanitizeDelta(delta));
    out = { pollution: pollution(), resultType: typeof result, result };
  } else {
    const result = new Patcher().applyPatch(base, delta);
    out = { pollution: pollution(), resultType: typeof result, result };
  }
} catch (err) {
  out = { error: err?.constructor?.name + ": " + (err?.message ?? String(err)) };
}
console.log(JSON.stringify(out));
