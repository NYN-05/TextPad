export function createSyncListHandler(devices, files) {
  return (req, res) => {
    const device = devices.get(req.deviceId);
    const groupId = (device && device.groupId) || req.deviceId;
    const result = [];

    for (const f of files.all(groupId)) {
      result.push({
        fileId: f.fileId,
        name: f.name || "untitled.txt",
        version: f.version,
        deleted: f.deleted === true,
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      });
    }

    result.sort((a, b) => a.fileId.localeCompare(b.fileId));
    res.setHeader("Cache-Control", "private, max-age=30");
    res.json(result);
  };
}
