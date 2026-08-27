import { createStore } from "../lib/store.js";
import { createRegisterHandler } from "../handlers/register.js";
import { createSyncHandler } from "../handlers/sync.js";
import { createAuthMiddleware } from "../middleware/auth.js";
import { validateSyncBody } from "../middleware/validation.js";

const store = createStore(":memory:");
const reg = createRegisterHandler(store.devices);
const auth = createAuthMiddleware(store.devices);
const sync = createSyncHandler(store.devices, store.files);
const makeRes = () => ({ _s: 200, _j: null, status(c) { this._s = c; return this; }, json(d) { this._j = d; return this; }, end() {}, setHeader() {} });

let r = makeRes();
reg({ body: { deviceLabel: "d", groupId: "g" } }, r);
const { deviceId, sessionToken } = r._j;
const req = (ops) => {
  const res = makeRes();
  const o = { body: { ops }, get: (k) => ({ "X-Device-Id": deviceId, Authorization: `Bearer ${sessionToken}` })[k], method: "POST", path: "/api/sync" };
  auth(o, res, () => {});
  try { validateSyncBody(o.body); } catch (e) { res._j = { error: e.message }; res._s = 400; return res; }
  sync(o, res);
  return res;
};

for (let i = 0; i < 99; i++) req([{ fileId: `big-${i}`, type: "snapshot", baseVersion: 0, patch: "x".repeat(1_000_000), timestamp: Date.now() }]);
console.log("bytes after 99:", store.files.bytesForGroup("g"));
let last;
for (let i = 0; i < 50; i++) {
  last = req([{ fileId: `fill-${i}`, type: "snapshot", baseVersion: 0, patch: "x".repeat(100_000), timestamp: Date.now() }]);
  if (last._j.rejected?.length) { console.log("fill rejected:", JSON.stringify(last._j.rejected), "bytes:", store.files.bytesForGroup("g")); break; }
  console.log("fill accepted", i, "bytes:", store.files.bytesForGroup("g"));
}
const over = req([{ fileId: "overflow", type: "snapshot", baseVersion: 0, patch: "x", timestamp: Date.now() }]);
console.log("overflow response:", JSON.stringify(over._j), "bytes:", store.files.bytesForGroup("g"));
