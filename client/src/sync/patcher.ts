import { diff, patch, reverse, type Delta } from "jsondiffpatch";
import { sanitizeDelta } from "./delta-sanitize";

export class Patcher {
  computePatch(previous: string, current: string): Delta {
    if (previous === current) return {};
    return diff(previous, current) as Delta;
  }

  applyPatch(base: string, delta: Delta): string {
    if (typeof delta !== "object" || delta === null) return base;
    const result = patch(base, sanitizeDelta(delta) as Delta);
    return typeof result === "string" ? result : String(result ?? base);
  }

  computeReversePatch(previous: string, current: string): Delta {
    const forward = this.computePatch(previous, current);
    return reverse(forward) as Delta;
  }

  merge(ancestor: string, local: string, remote: string): { merged: string; conflict: boolean } {
    if (local === remote) return { merged: local, conflict: false };

    const localLines = local.split("\n");
    const remoteLines = remote.split("\n");
    const ancestorLines = ancestor.split("\n");
    const maxLen = Math.max(localLines.length, remoteLines.length, ancestorLines.length);
    const mergedLines: string[] = [];
    let hasConflict = false;

    for (let i = 0; i < maxLen; i++) {
      const a = ancestorLines[i] ?? "";
      const l = localLines[i] ?? "";
      const r = remoteLines[i] ?? "";

      if (l === r) {
        mergedLines.push(l);
      } else if (l === a) {
        mergedLines.push(r);
      } else if (r === a) {
        mergedLines.push(l);
      } else {
        mergedLines.push(`<<<<<<< local\n${l}\n=======\n${r}\n>>>>>>> remote`);
        hasConflict = true;
      }
    }

    return { merged: mergedLines.join("\n"), conflict: hasConflict };
  }
}
