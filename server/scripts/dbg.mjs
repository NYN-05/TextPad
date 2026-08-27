import { createStore } from "../lib/store.js";
import { createSyncHandler } from "../handlers/sync.js";
import { createSyncListHandler } from "../handlers/syncList.js";
import { createRegisterHandler } from "../handlers/register.js";

const store = createStore(":memory:");
const devices = store.devices;
const files = store.files;
const sync = createSyncHandler(devices, files);
const list = createSyncListHandler(devices, files);
const reg = createRegisterHandler(devices);

const res = () => ({ _s: 200, _j: null, status(c) { this._s = c; return this; }, json(d) { this._j = d; return this; }, end() {}, setHeader() {} });

const r1 = res(); reg({ body: { groupId: "g1", deviceLabel: "A" } }, r1);
const r2 = res(); reg({ body: { groupId: "g1", deviceLabel: "B" } }, r2);
const a = r1._j.deviceId;
const b = r2._j.deviceId;
console.log("devices:", devices.size, "a=", a, "b=", b);

const s = res();
sync({ deviceId: a, body: { ops: [{ fileId: "file-01", type: "snapshot", baseVersion: 0, patch: JSON.stringify("hello world"), name: "notes.txt", timestamp: Date.now() }] } }, s);
console.log("sync resp:", JSON.stringify(s._j));
console.log("store files size:", files.size, "group count:", files.all("g1").length);

const l = res();
list({ deviceId: b }, l);
console.log("list for B:", JSON.stringify(l._j));
