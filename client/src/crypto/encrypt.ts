function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

export class Encrypt {
  async generateKey(): Promise<CryptoKey> {
    return globalThis.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async encrypt(key: CryptoKey, fileId: string, plaintext: string): Promise<{ ciphertext: string; iv: Uint8Array<ArrayBuffer> }> {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const aad = new TextEncoder().encode(fileId);
    const ciphertext = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      encoded
    );
    return { ciphertext: arrayBufferToBase64(ciphertext), iv };
  }

  async decrypt(key: CryptoKey, fileId: string, ciphertext: string, iv: Uint8Array<ArrayBuffer>): Promise<string> {
    const aad = new TextEncoder().encode(fileId);
    const decrypted = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      key,
      base64ToArrayBuffer(ciphertext)
    );
    return new TextDecoder().decode(decrypted);
  }
}
