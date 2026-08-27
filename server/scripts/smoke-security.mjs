import { createStore } from "../lib/store.js";
import { validateSyncBody } from "../middleware/validation.js";
import { createSyncHandler } from "../handlers/sync.js";
import { createRegisterHandler } from "../handlers/register.js";

const store = createStore(":memory:");
const reg = createRegisterHandler(store.devices);
const makeRes = () => ({ _s: 200, _j: null, status(c) { this._s = c; return this; }, json(d) { this._j = d; return this; }, end() {}, setHeader() {} });
const r = makeRes();
reg({ body: { groupId: "g1", deviceLabel: "A" } }, r);
const { deviceId } = r._j;

const tries = (body) => {
  try { validateSyncBody(body); return "accepted"; } catch (e) { return e.message; }
};

const protoOp = JSON.parse('{"ops":[{"fileId":"a-1","type":"snapshot","patch":"x","__proto__":{"polluted":true}}]}');
console.log("proto-key via JSON body rejected:", tries(protoOp) !== "accepted");

const sync = createSyncHandler(store.devices, store.files);
const s = makeRes();
const ts30dAgo = Date.now() - 30 * 24 * 3600 * 1000;
sync({ deviceId, body: { ops: [{ fileId: "a-1", type: "snapshot", baseVersion: 0, patch: "c2ljaA==", name: "n.txt", timestamp: ts30dAgo }] } }, s);
const f = store.files.get("g1", "a-1");
const driftMs = Date.now() - f.updatedAt;
console.log("old timestamp clamped (drift " + Math.round(driftMs / 3600000) + "h, expect ~24h):", driftMs >= 0 && driftMs <= 25 * 3600 * 1000);
console.log("prototype NOT polluted:", ({}).polluted === undefined);
