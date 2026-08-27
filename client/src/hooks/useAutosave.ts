import { useRef, useCallback } from "react";

type SaveFn = (content: string) => Promise<void>;

export function useAutosave(save: SaveFn, delay = 500) {
  const timerRef = useRef<number | undefined>(undefined);
  const pendingRef = useRef<string | null>(null);
  const savingRef = useRef(false);

  const schedule = useCallback((content: string) => {
    pendingRef.current = content;
    if (savingRef.current) return;
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = window.setTimeout(async () => {
      const c = pendingRef.current;
      if (c === null) return;
      savingRef.current = true;
      try {
        await save(c);
      } finally {
        savingRef.current = false;
        pendingRef.current = null;
        if (timerRef.current !== undefined) {
          clearTimeout(timerRef.current);
          timerRef.current = undefined;
        }
      }
    }, delay);
  }, [save, delay]);

  const flush = useCallback(async () => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    const c = pendingRef.current;
    if (c !== null) {
      pendingRef.current = null;
      await save(c);
    }
  }, [save]);

  return { schedule, flush };
}
