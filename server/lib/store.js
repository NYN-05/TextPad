import { getDatabase } from "./database.js";

function key(groupId, fileId) {
  return `${groupId}|${fileId}`;
}

function fileBytes(record) {
  let n = 0;
  for (const v of record.versions) {
    if (v.patch) n += v.patch.length;
  }
  return n;
}

export function createStore(dbPath) {
  const db = getDatabase(dbPath);
  const cache = { devices: new Map(), files: new Map() };
  const fileState = new WeakMap();

  const stmt = {
    upsertDevice:      db.prepare("INSERT OR REPLACE INTO devices (id, label, group_id, created_at, last_sync_at) VALUES (?, ?, ?, ?, ?)"),
    deleteDevice:      db.prepare("DELETE FROM devices WHERE id = ?"),
    allDevices:        db.prepare("SELECT id, label, group_id, created_at, last_sync_at FROM devices"),

    upsertFile:        db.prepare("INSERT OR REPLACE INTO files (id, group_id, name, version, deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"),
    deleteFile:        db.prepare("DELETE FROM files WHERE id = ?"),
    allFiles:          db.prepare("SELECT id, group_id, name, version, deleted, created_at, updated_at FROM files"),

    insVersion:        db.prepare("INSERT INTO file_versions (file_id, version, encrypted_patch, iv, snapshot, timestamp) VALUES (?, ?, ?, ?, ?, ?)"),
    selVersions:       db.prepare("SELECT version, encrypted_patch, iv, snapshot, timestamp FROM file_versions WHERE file_id = ? ORDER BY version"),
    delVersions:       db.prepare("DELETE FROM file_versions WHERE file_id = ?"),
    delVersionsBefore: db.prepare("DELETE FROM file_versions WHERE file_id = ? AND version < ?"),

    delFileRefs:       db.prepare("DELETE FROM device_files WHERE file_id = ?"),
  };

  for (const row of stmt.allDevices.all()) {
    cache.devices.set(row.id, {
      _id: row.id,
      deviceLabel: row.label,
      groupId: row.group_id,
      createdAt: row.created_at,
      lastSyncAt: row.last_sync_at,
    });
  }

  for (const row of stmt.allFiles.all()) {
    const versions = stmt.selVersions.all(row.id);
    const record = {
      _id: key(row.group_id, row.id),
      groupId: row.group_id,
      fileId: row.id,
      name: row.name,
      version: row.version,
      deleted: row.deleted === 1,
      versions: versions.map((v) => ({
        version: v.version,
        patch: v.encrypted_patch,
        snapshot: v.snapshot === 1,
        timestamp: v.timestamp,
      })),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
    record.bytes = fileBytes(record);
    fileState.set(record, {
      min: record.versions.length ? record.versions[0].version : Infinity,
      max: record.versions.length ? record.versions[record.versions.length - 1].version : -Infinity,
    });
    cache.files.set(key(row.group_id, row.id), record);
  }

  function flushDevice(record) {
    stmt.upsertDevice.run(record._id, record.deviceLabel, record.groupId || record._id, record.createdAt, record.lastSyncAt);
  }

  function flushSyncFile(record) {
    stmt.upsertFile.run(record.fileId, record.groupId, record.name || "untitled.txt", record.version || 0, record.deleted ? 1 : 0, record.createdAt || Date.now(), record.updatedAt || Date.now());
    const versions = record.versions || [];
    const state = fileState.get(record) || { min: Infinity, max: -Infinity };
    let bytes = 0;
    for (const v of versions) {
      if (v.patch) bytes += v.patch.length;
      if (v.version > state.max) {
        stmt.insVersion.run(record.fileId, v.version, v.patch, null, v.snapshot ? 1 : 0, v.timestamp);
      }
    }
    record.bytes = bytes;
    if (versions.length === 0) {
      stmt.delVersions.run(record.fileId);
    } else if (versions[0].version > state.min) {
      stmt.delVersionsBefore.run(record.fileId, versions[0].version);
    }
    fileState.set(record, {
      min: versions.length ? versions[0].version : Infinity,
      max: versions.length ? versions[versions.length - 1].version : -Infinity,
    });
  }

  const proxyRecordCache = new WeakMap();
  const proxyFileCache = new WeakMap();

  function proxyRecord(record) {
    if (!record) return record;
    if (proxyRecordCache.has(record)) return proxyRecordCache.get(record);
    const p = new Proxy(record, {
      set(target, prop, value) {
        target[prop] = value;
        flushDevice(target);
        return true;
      },
    });
    proxyRecordCache.set(record, p);
    return p;
  }

  function proxyFile(record) {
    if (!record) return record;
    if (proxyFileCache.has(record)) return proxyFileCache.get(record);
    const p = new Proxy(record, {
      set(target, prop, value) {
        target[prop] = value;
        flushSyncFile(target);
        return true;
      },
    });
    proxyFileCache.set(record, p);
    return p;
  }

  return {
    devices: {
      get(key) { return proxyRecord(cache.devices.get(key)); },
      set(key, val) {
        if (!val._id) val._id = key;
        cache.devices.set(key, val);
        flushDevice(val);
      },
      delete(key) { cache.devices.delete(key); stmt.deleteDevice.run(key); },
      get size() { return cache.devices.size; },
    },

    files: {
      get(groupId, fileId) {
        const cached = cache.files.get(key(groupId, fileId));
        return cached ? proxyFile(cached) : null;
      },
      set(groupId, fileId, val) {
        if (!val._id) val._id = key(groupId, fileId);
        val.groupId = groupId;
        val.fileId = fileId;
        cache.files.set(key(groupId, fileId), val);
        flushSyncFile(val);
      },
      delete(groupId, fileId) {
        const k = key(groupId, fileId);
        const rec = cache.files.get(k);
        cache.files.delete(k);
        if (rec) {
          stmt.deleteFile.run(rec.fileId);
          stmt.delVersions.run(rec.fileId);
          stmt.delFileRefs.run(rec.fileId);
        }
      },
      all(groupId) {
        const out = [];
        for (const rec of cache.files.values()) {
          if (rec.groupId === groupId) out.push(proxyFile(rec));
        }
        return out;
      },
      bytesForGroup(groupId) {
        let n = 0;
        for (const rec of cache.files.values()) {
          if (rec.groupId !== groupId) continue;
          n += rec.bytes || 0;
        }
        return n;
      },
      get size() { return cache.files.size; },
      activeFileCount(groupId) {
        let n = 0;
        for (const rec of cache.files.values()) {
          if (rec.groupId === groupId && !rec.deleted) n++;
        }
        return n;
      },
    },

    getDevice(id) { return proxyRecord(cache.devices.get(id)); },
    setDevice(id, record) {
      if (!record._id) record._id = id;
      cache.devices.set(id, record);
      flushDevice(record);
    },
    deleteDevice(id) {
      cache.devices.delete(id);
      stmt.deleteDevice.run(id);
    },
    deviceCount() { return cache.devices.size; },

    getFile(groupId, fileId) {
      const c = cache.files.get(key(groupId, fileId));
      return c ? proxyFile(c) : null;
    },
    setFile(groupId, fileId, record) {
      if (!record._id) record._id = key(groupId, fileId);
      record.groupId = groupId;
      record.fileId = fileId;
      cache.files.set(key(groupId, fileId), record);
      flushSyncFile(record);
    },
    deleteFile(groupId, fileId) { this.files.delete(groupId, fileId); },
    fileCount() { return cache.files.size; },
    groupFileCount(groupId) {
      let n = 0;
      for (const rec of cache.files.values()) if (rec.groupId === groupId) n++;
      return n;
    },
  };
}
