export async function deriveGroupId(passphrase: string): Promise<string> {
  const clean = (passphrase || "").trim();
  if (!clean) return "";
  const data = new TextEncoder().encode(`textpad-group:${clean}`);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
