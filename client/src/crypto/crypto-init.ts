let _key: CryptoKey | null = null;
let _encryptionEnabled = true;

export function setCryptoKey(key: CryptoKey) {
  _key = key;
}

export function getCryptoKey(): CryptoKey | null {
  return _encryptionEnabled ? _key : null;
}

export function clearCryptoKey() {
  _key = null;
}

export function setEncryptionEnabled(enabled: boolean) {
  _encryptionEnabled = enabled;
}
