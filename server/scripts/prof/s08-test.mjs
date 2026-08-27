import { pathToFileURL } from "node:url";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mod = await import(pathToFileURL(join(__dirname, "../verify.mjs")).href);
const { createApi, ClientSim, expectFile, checkServerInvariants, assert } = mod;

async function awaitFlush(c) {
  await c.flush();
}

async function s08() {
  const api = createApi();
  const a = new ClientSim("A", "g1", api);
  const fid = "file-08";
  a.newFile(fid, "data that must survive");
  awaitFlush(a);

  const api2 = createApi();
  a.api = api2;
  a.deviceId = api2.register("g1", "A");
  a.syncedNames.clear();
  a.edit(fid, "data that must survive + edit after loss");
  await a.syncAll();
  await a.flush();
  const srv = api2.getServerFile("g1", fid);
  assert(srv && srv.versions.length === 1 && srv.versions[0].snapshot, "S08: client rebuilt server state with a snapshot");
  const fresh = new ClientSim("C", "g1", api2);
  await fresh.pull();
  expectFile(fresh, fid, "data that must survive + edit after loss");
  checkServerInvariants(api2, "g1", "S08");
}

await s08();
console.log("S08 focused test done");
