import { useState, useEffect } from "react";

export type CryptoStatus = "uninitialized" | "ready" | "error";

export function useCrypto(passphrase?: string) {
  const [status, setStatus] = useState<CryptoStatus>("uninitialized");

  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        if (!globalThis.crypto?.subtle) {
          console.warn("[crypto] Web Crypto API unavailable — files will NOT be encrypted at rest");
          if (!cancelled) setStatus("error");
          return;
        }
        const { Keychain } = await import("../crypto/keychain");
        const keychain = new Keychain();
        await keychain.getContentKey(passphrase || undefined);
        if (!cancelled) setStatus("ready");
      } catch (err) {
        console.error("[crypto] init failed:", err);
        if (!cancelled) setStatus("error");
      }
    };
    init();
    return () => { cancelled = true; };
  }, [passphrase]);

  return { status };
}
