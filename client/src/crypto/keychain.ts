import { storeKeyBlob, getKeyBlob } from "../db";
import { setCryptoKey, clearCryptoKey } from "./crypto-init";

const PBKDF2_ITERATIONS = 600_000;
const LEGACY_ITERATIONS = 100_000;

export class Keychain {
  private keyCache: CryptoKey | null = null;

  async generateContentKey(): Promise<CryptoKey> {
    return globalThis.crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async wrapKey(key: CryptoKey, wrappingKey: CryptoKey): Promise<ArrayBuffer> {
    return globalThis.crypto.subtle.wrapKey("raw", key, wrappingKey, { name: "AES-KW" });
  }

  async unwrapKey(wrapped: ArrayBuffer, wrappingKey: CryptoKey): Promise<CryptoKey> {
    return globalThis.crypto.subtle.unwrapKey(
      "raw", wrapped, wrappingKey,
      { name: "AES-KW" },
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
  }

  async deriveWrappingKey(passphrase: string, salt: Uint8Array<ArrayBuffer>, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
    const keyMaterial = await globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(passphrase),
      "PBKDF2",
      false,
      ["deriveKey"]
    );
    return globalThis.crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt,
        iterations,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-KW", length: 256 },
      false,
      ["wrapKey", "unwrapKey"]
    );
  }

  async setupPassphrase(passphrase: string): Promise<void> {
    const contentKey = await this.generateContentKey();
    const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
    const wrappingKey = await this.deriveWrappingKey(passphrase, salt);
    const wrapped = await this.wrapKey(contentKey, wrappingKey);
    await storeKeyBlob({
      key: "contentKey",
      type: "passphrase",
      salt: Array.from(salt),
      wrappedKey: Array.from(new Uint8Array(wrapped)),
      iterations: PBKDF2_ITERATIONS,
      createdAt: Date.now(),
    });
    this.keyCache = contentKey;
    setCryptoKey(contentKey);
  }

  async setupDeviceLocal(): Promise<void> {
    const contentKey = await this.generateContentKey();
    const raw = await globalThis.crypto.subtle.exportKey("raw", contentKey);
    await storeKeyBlob({
      key: "contentKey",
      type: "device",
      rawKey: Array.from(new Uint8Array(raw)),
      createdAt: Date.now(),
    });
    this.keyCache = contentKey;
    setCryptoKey(contentKey);
  }

  async getContentKey(passphrase?: string): Promise<CryptoKey> {
    if (this.keyCache) return this.keyCache;

    const blob = await getKeyBlob();
    if (!blob) {
      if (passphrase) {
        await this.setupPassphrase(passphrase);
      } else {
        await this.setupDeviceLocal();
      }
      return this.getContentKey(passphrase);
    }

    if (blob.type === "passphrase" && passphrase && blob.salt && blob.wrappedKey) {
      const salt = new Uint8Array(blob.salt);
      const iterations = blob.iterations ?? LEGACY_ITERATIONS;
      const wrappingKey = await this.deriveWrappingKey(passphrase, salt, iterations);
      const key = await this.unwrapKey(new Uint8Array(blob.wrappedKey).buffer, wrappingKey);
      this.keyCache = key;
      setCryptoKey(key);
      return key;
    }

    if (blob.type === "device" && blob.rawKey) {
      const key = await globalThis.crypto.subtle.importKey(
        "raw",
        new Uint8Array(blob.rawKey),
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
      this.keyCache = key;
      setCryptoKey(key);
      return key;
    }

    throw new Error("passphrase required");
  }

  clearCache(): void {
    this.keyCache = null;
    clearCryptoKey();
  }
}
