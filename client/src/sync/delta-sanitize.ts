const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export function sanitizeDelta(value: unknown): unknown {
  if (Array.isArray(value)) {
    if (value.length === 2 && typeof value[0] === "number" && typeof value[1] !== "object") return value;
    return value.map((item) => sanitizeDelta(item));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      if (FORBIDDEN_KEYS.has(key)) continue;
      out[key] = sanitizeDelta((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}
