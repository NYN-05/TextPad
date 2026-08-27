import { isValidFileId } from "../middleware/validation.js";

export function createSyncPullHandler(devices, files) {
  return (req, res) => {
    const device = devices.get(req.deviceId);
    const groupId = (device && device.groupId) || req.deviceId;
    const fileId = req.params.fileId;

    if (!isValidFileId(fileId)) {
      return res.status(400).json({ error: "invalid file id" });
    }

    const since = Number(req.query.since);
    if (!Number.isFinite(since) || since < 0) {
      return res.status(400).json({ error: "invalid since" });
    }

    const f = files.get(groupId, fileId);
    if (!f) return res.status(404).json({ error: "not found" });

    res.setHeader("Cache-Control", "private, no-store");
    if (f.deleted) {
      return res.json({
        deleted: true,
        name: f.name || "untitled.txt",
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
        version: f.version,
        versions: [],
      });
    }

    const firstVersion = f.versions[0]?.version ?? 0;
    const selected = since < firstVersion ? f.versions : f.versions.filter((v) => v.version > since);
    const versions = selected.map((v) => ({ version: v.version, patch: v.patch, timestamp: v.timestamp, snapshot: v.snapshot }));

    res.json({
      name: f.name || "untitled.txt",
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      version: f.version,
      versions,
    });
  };
}
