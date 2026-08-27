import { LIMITS } from "../lib/limits.js";

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const OP_TYPES = ["delta", "snapshot", "metadata", "delete"];
const FILE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export function isValidFileId(fileId) {
  return typeof fileId === "string" && FILE_ID_RE.test(fileId);
}

export function validateSyncBody(body) {
  if (!body || typeof body !== "object") throw new ValidationError("request body required");
  if (!Array.isArray(body.ops) || body.ops.length > LIMITS.maxOpsPerRequest)
    throw new ValidationError(`ops must be an array of max ${LIMITS.maxOpsPerRequest}`);

  const allowed = ["fileId", "type", "baseVersion", "patch", "name", "timestamp"];
  for (const op of body.ops) {
    if (!op || typeof op !== "object" || Array.isArray(op)) throw new ValidationError("invalid op");
    for (const key of Object.keys(op)) {
      if (!allowed.includes(key)) {
        throw new ValidationError(`unexpected key in op: ${key}`);
      }
    }
    if (!isValidFileId(op.fileId))
      throw new ValidationError("invalid fileId in op");
    if (op.type !== undefined && !OP_TYPES.includes(op.type))
      throw new ValidationError("invalid op type");
    if (op.baseVersion !== undefined && (typeof op.baseVersion !== "number" || op.baseVersion < 0 || !Number.isFinite(op.baseVersion)))
      throw new ValidationError("invalid baseVersion in op");
    if (op.timestamp !== undefined && (typeof op.timestamp !== "number" || !Number.isFinite(op.timestamp)))
      throw new ValidationError("invalid timestamp in op");
    if (op.type === "delete") {
      if (op.patch !== undefined || op.name !== undefined)
        throw new ValidationError("delete ops carry no patch or name");
    } else {
      if (typeof op.patch !== "string" || op.patch.length > LIMITS.maxPatchSize)
        throw new ValidationError("invalid patch in op");
    }
    if (op.name !== undefined && (typeof op.name !== "string" || op.name.length > LIMITS.maxNameLength))
      throw new ValidationError("invalid name in op");
  }
}
