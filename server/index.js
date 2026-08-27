import "./lib/loadEnv.js";
import express from "express";
import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createStore } from "./lib/store.js";
import { createRegisterHandler } from "./handlers/register.js";
import { createSyncHandler } from "./handlers/sync.js";
import { createSyncListHandler } from "./handlers/syncList.js";
import { createSyncPullHandler } from "./handlers/syncPull.js";
import { createSyncDeleteHandler } from "./handlers/syncDelete.js";
import { createHealthHandler } from "./handlers/health.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { syncLimiter, registerLimiter, cspLimiter, healthLimiter } from "./middleware/rateLimit.js";
import { validateSyncBody } from "./middleware/validation.js";
import { createAuthMiddleware } from "./middleware/auth.js";
import { requestLogger, default as logger } from "./lib/logger.js";

function validateEnv() {
  const required = [];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    process.exit(1);
  }
  const p = Number(process.env.PORT);
  if (process.env.PORT !== undefined && (Number.isNaN(p) || p < 1024 || p > 65535)) {
    console.error(`PORT must be between 1024 and 65535, got ${process.env.PORT}`);
    process.exit(1);
  }
}
validateEnv();

const app = express();

app.disable("x-powered-by");

const trustProxy = process.env.TRUST_PROXY !== undefined ? Number(process.env.TRUST_PROXY) : 1;
if (Number.isFinite(trustProxy) && trustProxy >= 0) {
  app.set("trust proxy", trustProxy);
}

app.use((_req, res, next) => {
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'"
  );
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
  if (_req.secure || _req.get("X-Forwarded-Proto") === "https") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000");
  }
  next();
});

const DEFAULT_ORIGINS = [
  "http://localhost:1420",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:4173",
];

const ALLOWED_ORIGINS = [
  ...DEFAULT_ORIGINS,
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean) : []),
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Device-Id");
    res.setHeader("Access-Control-Max-Age", "600");
  }
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }
  next();
});

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH"].includes(req.method) && !req.is("application/json")) {
    return res.status(415).json({ error: "unsupported media type, expected application/json" });
  }
  next();
});

app.use(
  express.json({
    limit: "5mb",
    strict: true,
  })
);

app.use(requestLogger);

// ── Static file serving (optional; frontend normally on Vercel) ─────

const __dirname = dirname(fileURLToPath(import.meta.url));
const staticRoot = join(__dirname, "../../client/dist");

if (existsSync(staticRoot)) {
  const oneYear = 31536000;

  app.use("/assets", (_req, res, next) => {
    res.setHeader("Cache-Control", `public, max-age=${oneYear}, immutable`);
    next();
  }, express.static(join(staticRoot, "assets"), { etag: true, lastModified: false }));

  app.use("/fonts", (_req, res, next) => {
    res.setHeader("Cache-Control", `public, max-age=${oneYear}, immutable`);
    next();
  }, express.static(join(staticRoot, "fonts"), { etag: true, lastModified: false }));

  app.get("/", (_req, res) => {
    const indexPath = join(staticRoot, "index.html");
    if (!existsSync(indexPath)) return res.status(404).end();
    const html = readFileSync(indexPath, "utf-8");
    res.setHeader("Cache-Control", "no-cache, must-revalidate");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  app.get("/index.html", (_req, res) => {
    res.redirect(301, "/");
  });
}

const store = createStore();
const requireAuth = createAuthMiddleware(store.devices);

// ── Sync API ────────────────────────────────────────────────

app.post("/api/sync/register", registerLimiter, createRegisterHandler(store.devices));

app.post("/api/sync", syncLimiter, requireAuth, (req, res, next) => {
  try {
    validateSyncBody(req.body);
    createSyncHandler(store.devices, store.files)(req, res);
  } catch (err) {
    next(err);
  }
});

app.get("/api/sync", syncLimiter, requireAuth, createSyncListHandler(store.devices, store.files));

app.get("/api/sync/:fileId", syncLimiter, requireAuth, createSyncPullHandler(store.devices, store.files));

app.delete("/api/sync/:fileId", syncLimiter, requireAuth, createSyncDeleteHandler(store.devices, store.files));

app.get("/api/health", healthLimiter, createHealthHandler(store.devices, store.files));

const CSP_REPORT_KEYS = [
  "document-uri",
  "referrer",
  "blocked-uri",
  "violated-directive",
  "effective-directive",
  "original-policy",
  "source-file",
  "script-sample",
];

app.post("/api/csp-report", cspLimiter, (req, res) => {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const report = body["csp-report"] && typeof body["csp-report"] === "object" ? body["csp-report"] : body;
  const safe = {};
  for (const key of CSP_REPORT_KEYS) {
    const value = report[key];
    if (typeof value === "string") {
      safe[key] = value.slice(0, 500);
    }
  }
  logger.warn({ cspReport: safe }, "csp-violation");
  res.status(204).end();
});

// ── Error handler ───────────────────────────────────────────

app.use("/api", (_req, res) => {
  res.status(404).json({ error: "not found" });
});

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => console.log(`server running on port ${PORT}`));
