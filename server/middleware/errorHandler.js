import logger from "../lib/logger.js";

export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const message = status === 500 ? "internal server error" : (err.message || "bad request");
  logger.error({
    method: req.method,
    path: req.path,
    err: String(err.stack || err.message).slice(0, 2000),
  });
  res.status(status).json({ error: message.slice(0, 500) });
}
