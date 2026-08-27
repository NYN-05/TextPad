"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeDelta = sanitizeDelta;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
function sanitizeDelta(value) {
    if (Array.isArray(value)) {
        if (value.length === 2 && typeof value[0] === "number" && typeof value[1] !== "object")
            return value;
        return value.map((item) => sanitizeDelta(item));
    }
    if (value && typeof value === "object") {
        const out = {};
        for (const key of Object.keys(value)) {
            if (FORBIDDEN_KEYS.has(key))
                continue;
            out[key] = sanitizeDelta(value[key]);
        }
        return out;
    }
    return value;
}
