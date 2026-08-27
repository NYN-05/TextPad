import { useState, useEffect } from "react";

export interface StorageEstimate {
  quota: number;
  usage: number;
  available: number;
  percent: number;
}

export function useStorageEstimate() {
  const [estimate, setEstimate] = useState<StorageEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const update = async () => {
      if (!navigator.storage?.estimate) {
        if (!cancelled) { setLoading(false); }
        return;
      }
      try {
        const est = await navigator.storage.estimate();
        const quota = est.quota ?? 0;
        const usage = est.usage ?? 0;
        if (!cancelled) {
          setEstimate({
            quota,
            usage,
            available: quota - usage,
            percent: quota > 0 ? (usage / quota) * 100 : 0,
          });
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };
    update();
    return () => { cancelled = true; };
  }, []);

  return { estimate, loading };
}
