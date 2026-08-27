import crypto from "node:crypto";
import { signToken, TOKEN_TTL_MS } from "../middleware/auth.js";
import { ValidationError } from "../middleware/validation.js";
import { LIMITS } from "../lib/limits.js";

const LABEL_RE = /^[\p{L}\p{N}\p{P}\p{S} ]{1,128}$/u;

export function createRegisterHandler(devices) {
  return (req, res) => {
    if (devices.size >= LIMITS.maxDevices) {
      return res.status(429).json({ error: "device limit reached" });
    }

    const deviceLabel = (req.body?.deviceLabel || "Unnamed Device").trim();
    const groupId = typeof req.body?.groupId === "string" ? req.body.groupId.trim() : "";

    if (deviceLabel.length > 128 || !LABEL_RE.test(deviceLabel)) {
      throw new ValidationError("invalid deviceLabel");
    }
    if (groupId.length > 64 || (groupId !== "" && !/^[A-Za-z0-9_-]+$/.test(groupId))) {
      throw new ValidationError("invalid groupId");
    }

    const deviceId = crypto.randomUUID();
    const expiresAt = Date.now() + TOKEN_TTL_MS;
    const sessionToken = signToken(deviceId, expiresAt);

    devices.set(deviceId, {
      _id: deviceId,
      deviceLabel,
      groupId: groupId || deviceId,
      createdAt: Date.now(),
      lastSyncAt: null,
    });

    console.log(`[register] New device: ${deviceId} ("${deviceLabel.slice(0, 32)}"${groupId ? ", group " + groupId.slice(0, 8) + "…" : ""})`);

    res.setHeader("Cache-Control", "private, no-store");
    res.status(201).json({
      deviceId,
      sessionToken,
      groupId: groupId || deviceId,
      expiresAt,
    });
  };
}
