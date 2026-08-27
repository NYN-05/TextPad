import { isValidFileId } from "../middleware/validation.js";

export function createSyncDeleteHandler(devices, files) {
  return (req, res) => {
    const device = devices.get(req.deviceId);
    const groupId = (device && device.groupId) || req.deviceId;
    const fileId = req.params.fileId;

    if (!isValidFileId(fileId)) {
      return res.status(400).json({ error: "invalid file id" });
    }

    const f = files.get(groupId, fileId);
    if (f) {
      f.deleted = true;
      f.versions = [];
      f.updatedAt = Date.now();
    }
    device.lastSyncAt = Date.now();

    res.setHeader("Cache-Control", "private, no-store");
    res.status(204).end();
  };
}
