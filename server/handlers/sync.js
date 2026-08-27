import { LIMITS } from "../lib/limits.js";

const TIMESTAMP_SKEW_MS = 24 * 60 * 60 * 1000;

function newestSnapshotVersion(versions) {
  for (let i = versions.length - 1; i >= 0; i--) {
    if (versions[i].snapshot) return versions[i].version;
  }
  return 0;
}

function pruneHistory(versions) {
  const max = LIMITS.maxVersionsPerFile + 1;
  let pruned = 0;
  while (versions.length > max) {
    const snap = newestSnapshotVersion(versions);
    if (versions[0].snapshot && versions[0].version === snap) break;
    versions.shift();
    pruned++;
  }
  return pruned;
}

function clampTimestamp(timestamp, serverNow) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return serverNow;
  return Math.min(Math.max(timestamp, serverNow - TIMESTAMP_SKEW_MS), serverNow + TIMESTAMP_SKEW_MS);
}

function fileBytes(record) {
  return record.bytes || 0;
}

export function createSyncHandler(devices, files) {
  return (req, res) => {
    const { ops } = req.body;
    const deviceId = req.deviceId;
    const device = devices.get(deviceId);
    const groupId = (device && device.groupId) || deviceId;
    const serverNow = Date.now();
    let groupBytes = files.bytesForGroup(groupId);

    const acceptedFiles = [];
    const acceptedVersions = [];
    const rejected = [];
    const serverOps = [];

    for (const op of ops) {
      const { fileId, patch, name } = op;
      const type = op.type || (patch === "{}" ? "metadata" : "delta");
      const baseVersion = op.baseVersion === undefined ? 0 : op.baseVersion;
      const existingFile = files.get(groupId, fileId);
      const now = clampTimestamp(op.timestamp, serverNow);
      const patchBytes = patch ? patch.length : 0;

      if (type === "delete") {
        if (existingFile) {
          groupBytes -= fileBytes(existingFile);
          existingFile.deleted = true;
          existingFile.versions = [];
          existingFile.updatedAt = now;
        }
        acceptedFiles.push(fileId);
        continue;
      }

      if (existingFile && existingFile.deleted && type !== "snapshot") {
        rejected.push({ fileId, reason: "file deleted" });
        continue;
      }

      if (!existingFile) {
        if (type !== "snapshot") {
          rejected.push({ fileId, reason: "not found" });
          continue;
        }
        if (files.activeFileCount(groupId) >= LIMITS.maxFilesPerDevice) {
          rejected.push({ fileId, reason: "too many files" });
          continue;
        }
        if (groupBytes + patchBytes > LIMITS.maxTotalBytesPerDevice) {
          rejected.push({ fileId, reason: "storage limit" });
          continue;
        }
        const version = Math.max(1, baseVersion);
        files.set(groupId, fileId, {
          name: name || "untitled.txt",
          version,
          deleted: false,
          versions: [{ version, patch, snapshot: true, timestamp: now }],
          createdAt: now,
          updatedAt: now,
        });
        groupBytes += patchBytes;
        acceptedFiles.push(fileId);
        acceptedVersions.push({ fileId, version });
        continue;
      }

      if (type === "metadata") {
        if (name) existingFile.name = name;
        existingFile.updatedAt = now;
        acceptedFiles.push(fileId);
        acceptedVersions.push({ fileId, version: existingFile.version });
        continue;
      }

      if (type === "snapshot") {
        if (baseVersion !== existingFile.version) {
          rejected.push({ fileId, reason: baseVersion < existingFile.version ? "stale version" : "version gap", currentVersion: existingFile.version });
          continue;
        }
        const oldBytes = fileBytes(existingFile);
        if (groupBytes - oldBytes + patchBytes > LIMITS.maxTotalBytesPerDevice) {
          rejected.push({ fileId, reason: "storage limit" });
          continue;
        }
        existingFile.version += 1;
        existingFile.versions.push({ version: existingFile.version, patch, snapshot: true, timestamp: now });
        const pruned = pruneHistory(existingFile.versions);
        existingFile.deleted = false;
        if (name) existingFile.name = name;
        existingFile.updatedAt = now;
        if (pruned > 0) {
          serverOps.push({ fileId, truncated: true, prunedVersion: existingFile.versions[0].version - 1 });
        } else if (existingFile.versions.length > LIMITS.maxVersionsPerFile + 1) {
          serverOps.push({ fileId, requestSnapshot: true });
        }
        groupBytes += patchBytes - oldBytes;
        acceptedFiles.push(fileId);
        acceptedVersions.push({ fileId, version: existingFile.version });
        continue;
      }

      if (baseVersion !== existingFile.version) {
        rejected.push({ fileId, reason: baseVersion < existingFile.version ? "stale version" : "version gap", currentVersion: existingFile.version });
        continue;
      }

      const oldBytes = fileBytes(existingFile);
      if (groupBytes - oldBytes + patchBytes > LIMITS.maxTotalBytesPerDevice) {
        rejected.push({ fileId, reason: "storage limit" });
        continue;
      }

      existingFile.version += 1;
      existingFile.versions.push({ version: existingFile.version, patch, snapshot: false, timestamp: now });
      const pruned = pruneHistory(existingFile.versions);
      if (name) existingFile.name = name;
      existingFile.updatedAt = now;
      if (pruned > 0) {
        serverOps.push({ fileId, truncated: true, prunedVersion: existingFile.versions[0].version - 1 });
      } else if (existingFile.versions.length > LIMITS.maxVersionsPerFile + 1) {
        serverOps.push({ fileId, requestSnapshot: true });
      }
      groupBytes += patchBytes - oldBytes;
      acceptedFiles.push(fileId);
      acceptedVersions.push({ fileId, version: existingFile.version });
    }

    device.lastSyncAt = Date.now();

    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      accepted: acceptedFiles.length,
      acceptedFiles,
      acceptedVersions,
      rejected,
      serverOps,
      truncatedHistory: serverOps.some((op) => op.truncated),
      serverTime: Date.now(),
    });
  };
}
