let startTime = Date.now();

export function createHealthHandler(devices, files) {
  return (_req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.json({
      status: "ok",
      uptime: Date.now() - startTime,
      deviceCount: devices.size,
      fileCount: files.size,
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    });
  };
}
