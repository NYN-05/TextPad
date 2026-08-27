import { diff, patch } from "jsondiffpatch";
import { sanitizeDelta } from "../sync/delta-sanitize";

interface WorkerMessage {
  id: number;
  type: "ENCRYPT" | "DECRYPT" | "COMPUTE_PATCH" | "MERGE" | "APPLY_PATCH";
  payload: unknown;
}

interface WorkerResponse {
  id: number;
  type: "RESULT";
  result: unknown;
}

self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { id, type, payload } = event.data;

  try {
    switch (type) {
      case "ENCRYPT": {
        const { key, iv, data } = payload as { key: CryptoKey; iv: Uint8Array<ArrayBuffer>; data: string };
        const encoded = new TextEncoder().encode(data);
        const ciphertext = await globalThis.crypto.subtle.encrypt(
          { name: "AES-GCM", iv },
          key,
          encoded
        );
        postResult(id, { ciphertext });
        break;
      }

      case "DECRYPT": {
        const { key, iv, ciphertext } = payload as { key: CryptoKey; iv: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer };
        const decrypted = await globalThis.crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          key,
          ciphertext
        );
        postResult(id, { plaintext: new TextDecoder().decode(decrypted) });
        break;
      }

      case "COMPUTE_PATCH": {
        const { previous, current } = payload as { previous: string; current: string };
        const delta = diff(previous, current);
        postResult(id, { delta });
        break;
      }

      case "APPLY_PATCH": {
        const { base, delta } = payload as { base: string; delta: import("jsondiffpatch").Delta };
        if (typeof delta !== "object" || delta === null) {
          postResult(id, { result: base });
          break;
        }
        const result = patch(base, sanitizeDelta(delta) as import("jsondiffpatch").Delta);
        postResult(id, { result: typeof result === "string" ? result : String(result ?? base) });
        break;
      }

      case "MERGE": {
        const { ancestor, local, remote } = payload as { ancestor: string; local: string; remote: string };
        const lines = mergeLines(ancestor, local, remote);
        postResult(id, lines);
        break;
      }

      default:
        postResult(id, { error: `unknown type: ${type}` });
    }
  } catch (err) {
    postResult(id, { error: String(err) });
  }
};

function postResult(id: number, result: unknown) {
  self.postMessage({ id, type: "RESULT", result } as WorkerResponse);
}

function mergeLines(ancestor: string, local: string, remote: string): { merged: string; conflict: boolean } {
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
