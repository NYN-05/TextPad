"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Encrypt = void 0;
function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}
function base64ToArrayBuffer(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
class Encrypt {
    async generateKey() {
        return globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
    }
    async encrypt(key, fileId, plaintext) {
        const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plaintext);
        const aad = new TextEncoder().encode(fileId);
        const ciphertext = await globalThis.crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, encoded);
        return { ciphertext: arrayBufferToBase64(ciphertext), iv };
    }
    async decrypt(key, fileId, ciphertext, iv) {
        const aad = new TextEncoder().encode(fileId);
        const decrypted = await globalThis.crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad }, key, base64ToArrayBuffer(ciphertext));
        return new TextDecoder().decode(decrypted);
    }
}
exports.Encrypt = Encrypt;
