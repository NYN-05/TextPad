import type { SyncOp, KeyBlob, SyncCredentials } from "./types";
import { getCryptoKey } from "./crypto/crypto-init";
import { generateUUID } from "./crypto/uuid";

const EncryptedPrefix = "~enc~";

export async function encryptContent(content: string, fileId: string): Promise<string> {
  const key = getCryptoKey();
  if (!key) return content;
  const { Encrypt } = await import("./crypto/encrypt");
  const enc = new Encrypt();
  const { ciphertext, iv } = await enc.encrypt(key, fileId, content);
  return `${EncryptedPrefix}${btoa(ciphertext)}:${btoa(String.fromCharCode(...iv))}`;
}

export async function decryptContent(stored: string, fileId: string): Promise<string> {
  if (!stored.startsWith(EncryptedPrefix)) return stored;
  const key = getCryptoKey();
  if (!key) return stored;
  const rest = stored.slice(EncryptedPrefix.length);
  const sep = rest.indexOf(":");
  if (sep === -1) return stored;
  const ciphertext = atob(rest.slice(0, sep));
  const ivBytes = atob(rest.slice(sep + 1));
  const iv = new Uint8Array(ivBytes.length);
  for (let i = 0; i < ivBytes.length; i++) iv[i] = ivBytes.charCodeAt(i);
  const { Encrypt } = await import("./crypto/encrypt");
  const enc = new Encrypt();
  return enc.decrypt(key, fileId, ciphertext, iv);
}

async function maybeEncrypt(content: string, fileId: string): Promise<string> {
  return encryptContent(content, fileId);
}

async function maybeDecrypt(stored: string, fileId: string): Promise<string> {
  return decryptContent(stored, fileId);
}

export interface LocalFile {
  id: string;
  name: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  syncedAt: number;
  version: number;
  baseContent?: string;
}

const DB = "textpad";
const VER = 5;
const STORES = { files: "files", queue: "sync_queue", keychain: "keychain", meta: "sync_meta" };

let dbPromise: Promise<IDBDatabase> | null = null;

function getDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains(STORES.files)) {
        d.createObjectStore(STORES.files, { keyPath: "id" });
      }
      if (!d.objectStoreNames.contains(STORES.queue)) {
        d.createObjectStore(STORES.queue, { keyPath: "id", autoIncrement: true });
      }
      if (!d.objectStoreNames.contains(STORES.keychain)) {
        d.createObjectStore(STORES.keychain, { keyPath: "key" });
      }
      if (!d.objectStoreNames.contains(STORES.meta)) {
        d.createObjectStore(STORES.meta, { keyPath: "key" });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onclose = () => { dbPromise = null; };
      db.onversionchange = () => { db?.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await getDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const req = fn(t.objectStore(storeName));
    req.onsuccess = () => {
      if (mode === "readonly") resolve(req.result);
    };
    req.onerror = () => reject(req.error);
    t.oncomplete = () => {
      if (mode !== "readonly") resolve(req.result);
    };
    t.onabort = () => reject(t.error);
  });
}

async function decryptFile(f: LocalFile): Promise<LocalFile> {
  try {
    f.content = await maybeDecrypt(f.content, f.id);
    if (f.baseContent !== undefined) {
      f.baseContent = await maybeDecrypt(f.baseContent, f.id);
    }
  } catch (err) {
    console.warn(`[db] failed to decrypt file ${f.id}:`, err);
  }
  return f;
}

export async function getAllFiles(): Promise<LocalFile[]> {
  const files = await tx(STORES.files, "readonly", (s) => s.getAll());
  const results: LocalFile[] = [];
  for (const f of files) {
    results.push(await decryptFile(f));
  }
  return results;
}

export async function getFile(id: string): Promise<LocalFile | undefined> {
  const file = await tx(STORES.files, "readonly", (s) => s.get(id));
  if (file) return decryptFile(file);
  return file;
}

export async function getFileCipher(id: string): Promise<{ version: number; content: string } | undefined> {
  const file = await tx(STORES.files, "readonly", (s) => s.get(id));
  if (!file) return undefined;
  return { version: file.version ?? 0, content: file.content };
}

export interface FileMeta {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  syncedAt: number;
  version: number;
}

export async function getAllFilesMeta(): Promise<FileMeta[]> {
  const files = await tx(STORES.files, "readonly", (s) => s.getAll());
  return files.map(({ id, name, createdAt, updatedAt, syncedAt, version }) => ({
    id,
    name,
    createdAt,
    updatedAt,
    syncedAt,
    version: version ?? 0,
  }));
}

export async function addFile(file: LocalFile): Promise<IDBValidKey> {
  file.content = await maybeEncrypt(file.content, file.id);
  if (file.baseContent !== undefined) {
    file.baseContent = await maybeEncrypt(file.baseContent, file.id);
  }
  return tx(STORES.files, "readwrite", (s) => s.add(file));
}

export async function updateFile(id: string, patch: Partial<LocalFile>): Promise<void> {
  const db = await getDB();
  if (patch.content !== undefined) {
    patch.content = await maybeEncrypt(patch.content, id);
  }
  if (patch.baseContent !== undefined) {
    patch.baseContent = await maybeEncrypt(patch.baseContent, id);
  }
  return new Promise<void>((resolve, reject) => {
    const t = db.transaction(STORES.files, "readwrite");
    const s = t.objectStore(STORES.files);
    const get = s.get(id);
    get.onsuccess = () => {
      const existing = get.result;
      if (!existing) { resolve(); return; }
      Object.assign(existing, patch);
      s.put(existing);
    };
    get.onerror = () => reject(get.error);
    t.oncomplete = () => resolve();
    t.onabort = () => reject(t.error);
  });
}

export async function updateFileIfUnchanged(
  id: string,
  expected: { version?: number; content?: string },
  patch: Partial<LocalFile>
): Promise<boolean> {
  const db = await getDB();
  const raw = await new Promise<{ version: number; content: string } | undefined>((resolve, reject) => {
    const t = db.transaction(STORES.files, "readonly");
    const r = t.objectStore(STORES.files).get(id);
    r.onsuccess = () => resolve(r.result ? { version: r.result.version ?? 0, content: r.result.content } : undefined);
    r.onerror = () => reject(r.error);
  });
  if (!raw) return false;
  if (expected.version !== undefined && raw.version !== expected.version) return false;
  if (expected.content !== undefined && raw.content !== expected.content) return false;
  if (patch.content !== undefined) {
    patch.content = await maybeEncrypt(patch.content, id);
  }
  if (patch.baseContent !== undefined) {
    patch.baseContent = await maybeEncrypt(patch.baseContent, id);
  }
  return new Promise<boolean>((resolve, reject) => {
    const t = db.transaction(STORES.files, "readwrite");
    const s = t.objectStore(STORES.files);
    const get = s.get(id);
    get.onsuccess = () => {
      const existing = get.result;
      if (!existing) { resolve(false); return; }
      if (expected.version !== undefined && existing.version !== expected.version) { resolve(false); return; }
      if (expected.content !== undefined && existing.content !== expected.content) { resolve(false); return; }
      Object.assign(existing, patch);
      s.put(existing);
    };
    get.onerror = () => reject(get.error);
    t.oncomplete = () => resolve(true);
    t.onabort = () => reject(t.error);
  });
}

export function deleteFile(id: string): Promise<void> {
  return tx(STORES.files, "readwrite", (s) => s.delete(id)).then(() => undefined);
}

export function countFiles(): Promise<number> {
  return tx(STORES.files, "readonly", (s) => s.count());
}

export function createFile(name: string): Promise<LocalFile> {
  const now = Date.now();
  const file: LocalFile = {
    id: generateUUID(),
    name,
    content: "",
    createdAt: now,
    updatedAt: now,
    syncedAt: 0,
    version: 0,
    baseContent: "",
  };
  return addFile(file).then(() => file);
}

// ── Sync Queue ─────────────────────────────────────────────

export function enqueueOp(op: Omit<SyncOp, "id">): Promise<IDBValidKey> {
  return tx(STORES.queue, "readwrite", (s) => s.add({ ...op, createdAt: Date.now() }));
}

export function dequeueOp(id: number): Promise<void> {
  return tx(STORES.queue, "readwrite", (s) => s.delete(id)).then(() => undefined);
}

export function getPendingOps(): Promise<SyncOp[]> {
  return tx(STORES.queue, "readonly", (s) => s.getAll());
}

export function getPendingOpsByFile(fileId: string): Promise<SyncOp[]> {
  return new Promise(async (resolve, reject) => {
    const db = await getDB();
    const t = db.transaction(STORES.queue, "readonly");
    const req = t.objectStore(STORES.queue).getAll();
    req.onsuccess = () => resolve(req.result.filter((op: SyncOp) => op.fileId === fileId));
    req.onerror = () => reject(req.error);
  });
}

export function removePendingOps(fileId: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const db = await getDB();
    const t = db.transaction(STORES.queue, "readwrite");
    const s = t.objectStore(STORES.queue);
    const req = s.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(); return; }
      if (cursor.value?.fileId === fileId) cursor.delete();
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
    t.oncomplete = () => resolve();
    t.onabort = () => reject(t.error);
  });
}

// ── Tombstones (deleted files, never resurrect) ────────────

export async function getTombstones(): Promise<string[]> {
  const rec = await tx(STORES.meta, "readonly", (s) => s.get("tombstones"));
  return Array.isArray(rec?.ids) ? rec.ids : [];
}

export function addTombstone(fileId: string): Promise<void> {
  return new Promise(async (resolve, reject) => {
    const db = await getDB();
    const t = db.transaction(STORES.meta, "readwrite");
    const s = t.objectStore(STORES.meta);
    const get = s.get("tombstones");
    get.onsuccess = () => {
      const rec = get.result;
      const ids = Array.isArray(rec?.ids) ? rec.ids : [];
      if (ids.includes(fileId)) { resolve(); return; }
      s.put({ key: "tombstones", ids: [...ids, fileId] });
    };
    get.onerror = () => reject(get.error);
    t.oncomplete = () => resolve();
    t.onabort = () => reject(t.error);
  });
}

// ── Keychain / credentials ─────────────────────────────────

export function storeKeyBlob(blob: KeyBlob): Promise<IDBValidKey> {
  return tx(STORES.keychain, "readwrite", (s) => s.put(blob));
}

export function getKeyBlob(): Promise<KeyBlob | undefined> {
  return tx(STORES.keychain, "readonly", (s) => s.get("contentKey"));
}

export function storeSyncCredentials(creds: SyncCredentials): Promise<IDBValidKey> {
  return tx(STORES.keychain, "readwrite", (s) => s.put({ key: "sync-credentials", ...creds }));
}

export function removeSyncCredentials(): Promise<void> {
  return tx(STORES.keychain, "readwrite", (s) => s.delete("sync-credentials")).then(() => undefined);
}

export async function getSyncCredentials(): Promise<SyncCredentials | undefined> {
  const rec = await tx(STORES.keychain, "readonly", (s) => s.get("sync-credentials"));
  if (rec && typeof rec.deviceId === "string" && typeof rec.sessionToken === "string") {
    return { deviceId: rec.deviceId, sessionToken: rec.sessionToken };
  }
  return undefined;
}
