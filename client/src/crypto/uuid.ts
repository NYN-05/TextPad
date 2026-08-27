export function generateUUID(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  let s = "";
  for (let i = 0; i < 16; i++) {
    s += (i === 4 || i === 6 || i === 8 || i === 10 ? "-" : "") +
      bytes[i].toString(16).padStart(2, "0");
  }
  return s;
}
