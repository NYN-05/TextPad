"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Patcher = void 0;
const jsondiffpatch_1 = require("jsondiffpatch");
const delta_sanitize_1 = require("./delta-sanitize.cjs");
class Patcher {
    computePatch(previous, current) {
        if (previous === current)
            return {};
        return (0, jsondiffpatch_1.diff)(previous, current);
    }
    applyPatch(base, delta) {
        if (typeof delta !== "object" || delta === null)
            return base;
        const result = (0, jsondiffpatch_1.patch)(base, (0, delta_sanitize_1.sanitizeDelta)(delta));
        return typeof result === "string" ? result : String(result ?? base);
    }
    computeReversePatch(previous, current) {
        const forward = this.computePatch(previous, current);
        return (0, jsondiffpatch_1.reverse)(forward);
    }
    merge(ancestor, local, remote) {
        if (local === remote)
            return { merged: local, conflict: false };
        const localLines = local.split("\n");
        const remoteLines = remote.split("\n");
        const ancestorLines = ancestor.split("\n");
        const maxLen = Math.max(localLines.length, remoteLines.length, ancestorLines.length);
        const mergedLines = [];
        let hasConflict = false;
        for (let i = 0; i < maxLen; i++) {
            const a = ancestorLines[i] ?? "";
            const l = localLines[i] ?? "";
            const r = remoteLines[i] ?? "";
            if (l === r) {
                mergedLines.push(l);
            }
            else if (l === a) {
                mergedLines.push(r);
            }
            else if (r === a) {
                mergedLines.push(l);
            }
            else {
                mergedLines.push(`<<<<<<< local\n${l}\n=======\n${r}\n>>>>>>> remote`);
                hasConflict = true;
            }
        }
        return { merged: mergedLines.join("\n"), conflict: hasConflict };
    }
}
exports.Patcher = Patcher;
