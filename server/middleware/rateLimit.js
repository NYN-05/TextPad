import rateLimit, { ipKeyGenerator } from "express-rate-limit";

function isLocalhost(ip) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1" || ip === "localhost";
}

const baseOptions = {
  standardHeaders: true,
  skip: (req) => isLocalhost(req.ip),
  keyGenerator: (req) => ipKeyGenerator(req.ip),
};

export const registerLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { error: "too many registration attempts" },
});

export const syncLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 120,
  message: { error: "too many requests" },
});

export const cspLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: "too many requests" },
});

export const healthLimiter = rateLimit({
  ...baseOptions,
  windowMs: 60 * 1000,
  limit: 60,
  message: { error: "too many requests" },
});
