import { createApi, ClientSim } from "./verify.mjs";

const step = (m) => process.stderr.write("[dbg] " + m + "\n");
const api = createApi();
const a = new ClientSim("A", "g1", api);
const fid = "file-08";
a.newFile(fid, "data that must survive");
await a.flush();
step("after first flush: queue=" + a.queue.size + " version=" + a.files.get(fid).version);

const api2 = createApi();
a.api = api2;
a.deviceId = api2.register("g1", "A");
a.syncedNames.clear();
a.edit(fid, "data that must survive + edit after loss");
step("after edit: queue=" + a.queue.size + " opType=" + (a.queue.get(fid) || {}).type);
await a.syncAll();
step("after syncAll: queue=" + a.queue.size + " opType=" + (a.queue.get(fid) || {}).type);
await a.flush();
step("after flush2: queue=" + a.queue.size);
const srv = api2.getServerFile("g1", fid);
step("srv=" + JSON.stringify(srv && { version: srv.version, deleted: srv.deleted, versions: srv.versions.map((v) => ({ v: v.version, snap: v.snapshot, patch: v.patch })) }));
