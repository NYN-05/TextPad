import { Transport } from "./transport";
import { StorageQueue } from "./storage";
import { Patcher } from "./patcher";
import {
  getPendingOps,
  removePendingOps,
  updateFile,
  updateFileIfUnchanged,
  getFile,
  getFileCipher,
  getSyncCredentials,
  storeSyncCredentials,
  removeSyncCredentials,
  encryptContent,
  decryptContent,
  addFile,
  deleteFile as dbDelete,
  getTombstones,
  addTombstone,
} from "../db";
import type { LocalFile } from "../db";
import type { SyncOp, SyncCredentials, RejectedOp, AcceptedVersion, SyncFileMeta, PulledFile } from "../types";

const FLUSH_DELAY_MS = 3000;
const MAX_OPS_PER_REQUEST = 100;
const MAX_PATCH_CHARS = 700_000;
const MAX_SNAPSHOT_CHARS = 1_000_000;
const MAX_RETRIES = 4;
const PULL_STALE_MS = 5 * 60 * 1000;
const PULL_KEY = "textpad-last-pull";
const LOCK_NAME = "textpad-sync";
const CHANNEL_NAME = "textpad-sync";
const VALID_FILE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

interface EngineConfig {
  syncUrl: string;
  groupId?: string;
  deviceId?: string;
  sessionToken?: string;
}

interface FlushResult {
  ok: boolean;
  accepted: string[];
  rejected: string[];
}

interface PulledContent extends PulledFile {
  content?: string;
}

export class SyncEngine {
  private transport: Transport;
  private queue: StorageQueue;
  private patcher: Patcher;
  private config: EngineConfig;
  private online: boolean;
  private flushTimer: number | undefined;
  private flushing = false;
  private worker: PatchWorker | null;
  private syncedNames = new Map<string, string>();
  private onFilesUpdatedCb: ((ids: string[]) => void) | null = null;
  private broadcast: BroadcastChannel | null = null;

  constructor(config: EngineConfig) {
    this.config = config;
    this.transport = new Transport(config.syncUrl);
    this.queue = new StorageQueue();
    this.patcher = new Patcher();
    this.online = navigator.onLine;
    this.worker = createPatchWorker();

    try {
      this.broadcast = new BroadcastChannel(CHANNEL_NAME);
      this.broadcast.addEventListener("message", (event) => {
        const ids = (event as MessageEvent).data?.ids;
        if ((event as MessageEvent).data?.type === "files-updated" && Array.isArray(ids)) {
          this.onFilesUpdatedCb?.(ids as string[]);
        }
      });
    } catch {
      this.broadcast = null;
    }

    window.addEventListener("online", () => {
      this.online = true;
      this.onOnline();
    });
    window.addEventListener("offline", () => {
      this.online = false;
    });
  }

  isOnline(): boolean {
    return this.online;
  }

  isReady(): boolean {
    return Boolean(this.config.deviceId && this.config.sessionToken);
  }

  setOnFilesUpdated(cb: (ids: string[]) => void): void {
    this.onFilesUpdatedCb = cb;
  }

  async init(): Promise<boolean> {
    return this.ensureCredentials();
  }

  async onOnline(): Promise<void> {
    if (!this.online || !this.isReady()) return;
    await this.syncAll();
    await this.flush();
    await this.pull(true);
  }

  async syncAll(): Promise<number> {
    if (!this.online || !this.isReady()) return 0;
    const { getAllFiles } = await import("../db");
    const files = await getAllFiles();
    const toEnqueue = files.filter((f) => f.version === 0 || f.baseContent === undefined || f.baseContent !== f.content);
    await Promise.all(toEnqueue.map((f) => this.enqueue(f)));
    if (toEnqueue.length > 0) await this.flush();
    return toEnqueue.length;
  }

  private authHeaders(): Record<string, string> {
    return {
      "X-Device-Id": this.config.deviceId || "",
      Authorization: `Bearer ${this.config.sessionToken || ""}`,
    };
  }

  private async ensureCredentials(force = false): Promise<boolean> {
    if (!force && this.isReady()) return true;
    const existing = await getSyncCredentials();
    if (!force && existing) {
      this.config.deviceId = existing.deviceId;
      this.config.sessionToken = existing.sessionToken;
      return true;
    }
    const res = await this.transport.post("/api/sync/register", {
      deviceLabel: "TextPad Browser",
      groupId: this.config.groupId,
    });
    if (res.ok && res.data && typeof res.data === "object" && "deviceId" in res.data && "sessionToken" in res.data) {
      const creds: SyncCredentials = {
        deviceId: String(res.data.deviceId),
        sessionToken: String(res.data.sessionToken),
      };
      this.config.deviceId = creds.deviceId;
      this.config.sessionToken = creds.sessionToken;
      await storeSyncCredentials(creds);
      return true;
    }
    return false;
  }

  private async recoverAuth(): Promise<boolean> {
    await removeSyncCredentials();
    this.config.deviceId = undefined;
    this.config.sessionToken = undefined;
    return this.ensureCredentials(true);
  }

  private async withLock<T>(fn: () => Promise<T>): Promise<T> {
    const locks = navigator.locks;
    if (!locks) return fn();
    return new Promise<T>((resolve, reject) => {
      locks.request(LOCK_NAME, { ifAvailable: true }, async (lock) => {
        try {
          resolve(await fn());
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  private async scheduleFlush(): Promise<void> {
    if (this.flushTimer !== undefined) {
      clearTimeout(this.flushTimer);
    }
    this.flushTimer = window.setTimeout(() => {
      this.flushTimer = undefined;
      this.flush();
    }, FLUSH_DELAY_MS);
  }

  async enqueue(file: LocalFile): Promise<void> {
    const mode = await this.computeOp(file);
    if (!mode) return;
    await removePendingOps(file.id);
    await this.queue.push(mode);
    await this.scheduleFlush();
  }

  private async computeOp(file: LocalFile): Promise<Omit<SyncOp, "id"> | null> {
    if (!this.isReady()) return null;
    const neverSynced = file.version === 0 || file.baseContent === undefined;

    if (neverSynced) {
      if (file.content.length > MAX_SNAPSHOT_CHARS) {
        console.warn(`[sync] ${file.id} exceeds snapshot size limit — kept local only`);
        return null;
      }
      return {
        fileId: file.id,
        type: "snapshot",
        baseVersion: 0,
        patch: await encryptContent(file.content, file.id),
        name: file.name,
        contentAfter: file.content,
        timestamp: Date.now(),
        retries: 0,
      };
    }

    const delta = await this.computePatch(file.baseContent!, file.content);
    const serialized = JSON.stringify(delta ?? {});
    const empty = serialized === "{}";
    if (empty && this.syncedNames.get(file.id) === file.name) return null;

    if (empty) {
      return {
        fileId: file.id,
        type: "metadata",
        baseVersion: file.version,
        name: file.name,
        contentAfter: file.content,
        timestamp: Date.now(),
        retries: 0,
      };
    }

    if (serialized.length > MAX_PATCH_CHARS) {
      if (file.content.length > MAX_SNAPSHOT_CHARS) {
        console.warn(`[sync] ${file.id} exceeds snapshot size limit — kept local only`);
        return null;
      }
      return {
        fileId: file.id,
        type: "snapshot",
        baseVersion: file.version,
        patch: await encryptContent(file.content, file.id),
        name: file.name,
        contentAfter: file.content,
        timestamp: Date.now(),
        retries: 0,
      };
    }

    return {
      fileId: file.id,
      type: "delta",
      baseVersion: file.version,
      patch: await encryptContent(serialized, file.id),
      name: file.name,
      contentAfter: file.content,
      timestamp: Date.now(),
      retries: 0,
    };
  }

  private computePatch(previous: string, current: string): Promise<unknown> {
    if (this.worker) return this.worker.computePatch(previous, current);
    return Promise.resolve(this.patcher.computePatch(previous, current));
  }

  private applyPatch(base: string, patch: string): Promise<string> {
    if (this.worker) return this.worker.applyPatch(base, patch);
    return Promise.resolve(this.patcher.applyPatch(base, JSON.parse(patch)));
  }

  private mergeText(ancestor: string, local: string, remote: string): Promise<{ merged: string; conflict: boolean }> {
    if (this.worker) return this.worker.merge(ancestor, local, remote);
    return Promise.resolve(this.patcher.merge(ancestor, local, remote));
  }

  async flush(): Promise<FlushResult> {
    if (!this.online || this.flushing || !this.isReady()) {
      return { ok: false, accepted: [], rejected: [] };
    }
    return this.withLock(async () => {
      this.flushing = true;
      try {
        const ops = (await getPendingOps()).filter((op) => op.retries < MAX_RETRIES);
        const batch = ops.slice(0, MAX_OPS_PER_REQUEST);
        if (batch.length === 0) return { ok: true, accepted: [], rejected: [] };

        const payload = batch.map(({ id: _id, contentAfter: _ca, retries: _r, ...op }) => op);
        let res = await this.transport.post("/api/sync", { ops: payload }, this.authHeaders());

        if (res.status === 401) {
          if (await this.recoverAuth()) {
            res = await this.transport.post("/api/sync", { ops: payload }, this.authHeaders());
          }
        }
        if (!res.ok || !res.data || typeof res.data !== "object") {
          await this.markFailed(batch, res.status);
          return { ok: false, accepted: [], rejected: [] };
        }
        return await this.handleFlushResponse(batch, res);
      } finally {
        this.flushing = false;
      }
    });
  }

  private async markFailed(ops: SyncOp[], status: number): Promise<void> {
    await Promise.all(
      ops.map(async (op) => {
        if (op.id === undefined) return;
        if ((op.retries ?? 0) + 1 >= MAX_RETRIES) {
          await this.queue.remove(op.id);
          await updateFile(op.fileId, { syncedAt: 0 });
        } else {
          await this.queue.push({ ...op, retries: (op.retries ?? 0) + 1 });
          await this.queue.remove(op.id);
        }
      })
    );
    console.warn(`[sync] flush failed (status ${status}), ${ops.length} op(s) retained`);
  }

  private async handleFlushResponse(ops: SyncOp[], res: { ok: boolean; status: number; data?: unknown }): Promise<FlushResult> {
    const data = res.data as {
      acceptedFiles?: string[];
      acceptedVersions?: AcceptedVersion[];
      rejected?: RejectedOp[];
      serverOps?: { fileId?: string; requestSnapshot?: boolean }[];
    };
    const acceptedFiles = Array.isArray(data.acceptedFiles) ? data.acceptedFiles : [];
    const acceptedVersions = Array.isArray(data.acceptedVersions) ? data.acceptedVersions : [];
    const rejectedRaw = Array.isArray(data.rejected) ? data.rejected : [];
    const serverOps = Array.isArray(data.serverOps) ? data.serverOps : [];
    const acceptedIds = new Set(acceptedFiles);
    const versionById = new Map(acceptedVersions.map((v) => [v.fileId, v.version]));
    const rejectedById = new Map(rejectedRaw.map((r) => [r.fileId, r]));
    const updatedIds: string[] = [];

    await Promise.all(
      ops.map(async (op) => {
        if (op.id === undefined) return;
        if (acceptedIds.has(op.fileId)) {
          const version = versionById.get(op.fileId);
          await updateFile(op.fileId, { baseContent: op.contentAfter, version: version ?? undefined, syncedAt: Date.now() });
          this.syncedNames.set(op.fileId, op.name ?? "");
          await this.queue.remove(op.id);
          if (op.type !== "delete") updatedIds.push(op.fileId);
        } else if (rejectedById.has(op.fileId)) {
          const rej = rejectedById.get(op.fileId)!;
          await this.queue.remove(op.id);
          await this.handleRejected(op, rej);
        } else {
          await this.queue.push({ ...op, retries: (op.retries ?? 0) + 1 });
          await this.queue.remove(op.id);
        }
      })
    );

    await Promise.all(
      serverOps.map(async (so) => {
        if (so?.requestSnapshot && typeof so.fileId === "string") {
          const f = await getFile(so.fileId);
          if (f) await this.pushSnapshot(f, f.version);
        }
      })
    );

    if (updatedIds.length > 0) this.notifyFilesUpdated(updatedIds);
    return { ok: true, accepted: acceptedFiles, rejected: rejectedRaw.map((r) => r.fileId) };
  }

  private async handleRejected(op: SyncOp, rejection: RejectedOp): Promise<void> {
    if (op.type === "delete") return;
    if (rejection.reason === "too many files") return;
    if (rejection.reason === "not found") {
      const f = await getFile(op.fileId);
      if (f) await this.pushSnapshot(f, 0);
      return;
    }
    await this.fixStale(op.fileId, rejection.currentVersion);
  }

  private async fixStale(fileId: string, serverVersion?: number): Promise<void> {
    const raw = await getFileCipher(fileId);
    const local = await getFile(fileId);
    if (!local) return;
    const remote = await this.pullFile(fileId, local.version, local.baseContent ?? "");
    if (!remote) {
      const f = await getFile(fileId);
      if (!f) return;
      await updateFile(fileId, { syncedAt: 0 });
      await this.pushSnapshot(f, serverVersion ?? 0);
      return;
    }
    const remoteContent = remote.content;
    if (remote.deleted) {
      if (local.baseContent !== local.content) {
        await this.pushSnapshot(local, remote.version ?? 0);
      } else {
        await addTombstone(fileId);
        await dbDelete(fileId);
        this.syncedNames.delete(fileId);
      }
      return;
    }
    if (remoteContent === undefined) {
      await this.pushSnapshot(local, serverVersion ?? remote.version);
      return;
    }
    if (local.baseContent === local.content) {
      const ok = await updateFileIfUnchanged(
        fileId,
        { version: raw?.version, content: raw?.content },
        { content: remoteContent, baseContent: remoteContent, version: remote.version, name: remote.name, updatedAt: remote.updatedAt }
      );
      if (ok) this.syncedNames.set(fileId, remote.name);
      return;
    }
    const { merged } = await this.mergeText(local.baseContent!, local.content, remoteContent);
    const ok = await updateFileIfUnchanged(
      fileId,
      { version: raw?.version, content: raw?.content },
      { content: merged, baseContent: remoteContent, version: remote.version, name: remote.name, updatedAt: Date.now() }
    );
    if (!ok) return;
    this.syncedNames.set(fileId, remote.name);
    if (merged !== remoteContent) {
      const f = await getFile(fileId);
      if (f) await this.enqueue(f);
    }
    this.notifyFilesUpdated([fileId]);
  }

  private async pushSnapshot(file: LocalFile, baseVersion: number): Promise<void> {
    if (file.content.length > MAX_SNAPSHOT_CHARS) return;
    await removePendingOps(file.id);
    await this.queue.push({
      fileId: file.id,
      type: "snapshot",
      baseVersion,
      patch: await encryptContent(file.content, file.id),
      name: file.name,
      contentAfter: file.content,
      timestamp: Date.now(),
      retries: 0,
    });
    await this.scheduleFlush();
  }

  async flushBeacon(): Promise<void> {
    if (!this.isReady()) return;
    const ops = await getPendingOps();
    if (ops.length === 0) return;
    const batch = ops.slice(0, MAX_OPS_PER_REQUEST).map((op) => ({
      fileId: op.fileId,
      type: op.type,
      baseVersion: op.baseVersion,
      patch: op.patch,
      name: op.name,
      timestamp: op.timestamp,
    }));
    const payload = JSON.stringify({
      deviceId: this.config.deviceId,
      sessionToken: this.config.sessionToken,
      ops: batch,
    });
    if (payload.length > 50_000) return;
    navigator.sendBeacon(`${this.config.syncUrl}/api/sync`, new Blob([payload], { type: "application/json" }));
  }

  async deleteFile(id: string): Promise<boolean> {
    if (!this.isReady()) return false;
    await removePendingOps(id);
    await addTombstone(id);
    await this.queue.push({
      fileId: id,
      type: "delete",
      baseVersion: 0,
      timestamp: Date.now(),
      retries: 0,
    });
    await this.scheduleFlush();
    return true;
  }

  async pull(force = false): Promise<string[]> {
    if (!this.online || !this.isReady()) return [];

    const lastPull = Number(localStorage.getItem(PULL_KEY) || 0);
    if (!force && Date.now() - lastPull < PULL_STALE_MS) return [];

    return this.withLock(async () => {
      let listRes = await this.transport.get("/api/sync", this.authHeaders());
      if (listRes.status === 401) {
        if (await this.recoverAuth()) {
          listRes = await this.transport.get("/api/sync", this.authHeaders());
        }
      }
      if (!listRes.ok || !Array.isArray(listRes.data)) return [];
      const metas = listRes.data as SyncFileMeta[];

      const { getAllFiles } = await import("../db");
      const locals = new Map((await getAllFiles()).map((f) => [f.id, f]));
      const tombstones = new Set(await getTombstones());
      const pending = new Set((await getPendingOps()).map((op) => op.fileId));

      const validMetas = metas.filter(
        (meta) => VALID_FILE_ID_RE.test(meta.fileId) &&
          typeof meta.name === "string" && meta.name.length <= 128 &&
          !tombstones.has(meta.fileId) &&
          !pending.has(meta.fileId)
      );

      const results = await Promise.all(
        validMetas.map(async (meta) => {
          const local = locals.get(meta.fileId);
          if (meta.deleted) {
            if (local && meta.version >= local.version) {
              await addTombstone(meta.fileId);
              await dbDelete(meta.fileId);
              return { fileId: meta.fileId, updated: true };
            }
            return { fileId: meta.fileId, updated: false };
          }
          if (local && meta.version <= local.version) return { fileId: meta.fileId, updated: false };
          if (local && local.baseContent !== local.content) return { fileId: meta.fileId, updated: false };

          const raw = local ? await getFileCipher(meta.fileId) : undefined;
          if (local && !raw) return { fileId: meta.fileId, updated: false };

          const detail = await this.pullFile(meta.fileId, local?.version ?? 0, local?.content ?? "");
          if (!detail || detail.content === undefined) return { fileId: meta.fileId, updated: false };

          const now = Date.now();
          if (local) {
            const ok = await updateFileIfUnchanged(
              meta.fileId,
              { version: raw!.version, content: raw!.content },
              { content: detail.content, baseContent: detail.content, version: meta.version, updatedAt: now }
            );
            if (ok) {
              this.syncedNames.set(meta.fileId, meta.name || "");
              return { fileId: meta.fileId, updated: true };
            }
            return { fileId: meta.fileId, updated: false };
          }
          try {
            await addFile({
              id: meta.fileId,
              name: meta.name || "untitled.txt",
              content: detail.content,
              createdAt: meta.createdAt,
              updatedAt: meta.updatedAt,
              syncedAt: now,
              version: meta.version,
              baseContent: detail.content,
            });
            this.syncedNames.set(meta.fileId, meta.name || "");
            return { fileId: meta.fileId, updated: true };
          } catch {
            return { fileId: meta.fileId, updated: false };
          }
        })
      );

      const updated = results.filter((r) => r.updated).map((r) => r.fileId);

      localStorage.setItem(PULL_KEY, String(Date.now()));
      if (updated.length > 0) this.notifyFilesUpdated(updated);
      return updated;
    });
  }

  private async pullFile(fileId: string, since: number, base: string): Promise<PulledContent | null> {
    const res = await this.transport.get(`/api/sync/${fileId}?since=${since}`, this.authHeaders());
    if (res.status === 401) {
      if (await this.recoverAuth()) {
        return this.pullFile(fileId, since, base);
      }
    }
    if (!res.ok || !res.data || typeof res.data !== "object") return null;
    const data = res.data as PulledFile;
    if (data.deleted) return data;
    if (!Array.isArray(data.versions)) return null;
    let content = base;
    try {
      for (const v of data.versions) {
        const plain = await decryptContent(v.patch, fileId);
        if (v.snapshot || v.version === 1) {
          content = plain;
        } else {
          content = await this.applyPatch(content, plain);
        }
      }
    } catch (err) {
      console.warn(`[sync] could not apply history for ${fileId}:`, err);
      return null;
    }
    return { ...data, content };
  }

  private notifyFilesUpdated(ids: string[]): void {
    this.onFilesUpdatedCb?.(ids);
    try {
      this.broadcast?.postMessage({ type: "files-updated", ids });
    } catch {}
  }
}

interface PatchWorker {
  computePatch(previous: string, current: string): Promise<unknown>;
  applyPatch(base: string, patch: string): Promise<string>;
  merge(ancestor: string, local: string, remote: string): Promise<{ merged: string; conflict: boolean }>;
}

function createPatchWorker(): PatchWorker | null {
  try {
    if (typeof Worker === "undefined") return null;
    const worker = new Worker(new URL("../workers/sync.worker.ts", import.meta.url));
    let seq = 0;
    const pending = new Map<number, { type: string; resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    worker.onmessage = (event: MessageEvent<{ id: number; type: string; result?: unknown }>) => {
      if (event.data?.type !== "RESULT") return;
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      const result = event.data.result as { error?: string; delta?: unknown; result?: unknown } | undefined;
      if (result && typeof result === "object" && "error" in result) {
        entry.reject(new Error(String(result.error)));
        return;
      }
      if (entry.type === "COMPUTE_PATCH") entry.resolve((result as { delta?: unknown })?.delta);
      else if (entry.type === "APPLY_PATCH") entry.resolve((result as { result?: unknown })?.result);
      else entry.resolve(result);
    };
    return {
      computePatch(previous, current) {
        return new Promise((resolve, reject) => {
          const id = ++seq;
          pending.set(id, { type: "COMPUTE_PATCH", resolve: resolve as (v: unknown) => void, reject });
          worker.postMessage({ id, type: "COMPUTE_PATCH", payload: { previous, current } });
        });
      },
      applyPatch(base, patch) {
        return new Promise((resolve, reject) => {
          const id = ++seq;
          pending.set(id, { type: "APPLY_PATCH", resolve: resolve as (v: unknown) => void, reject });
          worker.postMessage({ id, type: "APPLY_PATCH", payload: { base, delta: JSON.parse(patch) } });
        });
      },
      merge(ancestor, local, remote) {
        return new Promise((resolve, reject) => {
          const id = ++seq;
          pending.set(id, { type: "MERGE", resolve: resolve as (v: unknown) => void, reject });
          worker.postMessage({ id, type: "MERGE", payload: { ancestor, local, remote } });
        });
      },
    };
  } catch {
    return null;
  }
}
