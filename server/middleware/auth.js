import crypto from "node:crypto";

const SERVER_SECRET = process.env.API_SECRET || crypto.randomBytes(32).toString("hex");

if (!process.env.API_SECRET) {
  console.log(`[init] No API_SECRET set. Auto-generated: ${SERVER_SECRET}`);
}

export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function signToken(deviceId, expiresAt = Date.now() + TOKEN_TTL_MS) {
  const hmac = crypto
    .createHmac("sha256", SERVER_SECRET)
    .update(`${deviceId}|${expiresAt}`)
    .digest("base64");
  return `${expiresAt}:${hmac}`;
}

export function verifyToken(deviceId, token) {
  if (!deviceId || !token) return false;
  const parts = String(token).split(":");
  if (parts.length !== 2) return false;
  const expiresAt = Number(parts[0]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = signToken(deviceId, expiresAt);
  const a = Buffer.from(String(token));
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function extractCredentials(req) {
  const deviceId = req.get("X-Device-Id");
  const auth = req.get("Authorization") || "";
  const headerToken = auth.replace(/^Bearer\s+/i, "");
  if (deviceId && headerToken) {
    return { deviceId, sessionToken: headerToken };
  }
  if (req.method === "POST" && req.path === "/api/sync") {
    return {
      deviceId: deviceId || req.body?.deviceId,
      sessionToken: headerToken || req.body?.sessionToken,
    };
  }
  return { deviceId, sessionToken: headerToken || undefined };
}

export function createAuthMiddleware(devices) {
  return (req, res, next) => {
    const { deviceId, sessionToken } = extractCredentials(req);
    if (!verifyToken(deviceId, sessionToken)) {
      return res.status(401).json({ error: "unauthorized" });
    }
    if (!devices.get(deviceId)) {
      return res.status(401).json({ error: "device not registered" });
    }
    req.deviceId = deviceId;
    next();
  };
}
