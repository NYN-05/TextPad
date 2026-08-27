import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { LocalFile } from "../db";
import type { FileMeta } from "../types";

export interface SearchMatch {
  fileId: string;
  fileName: string;
  line: number;
  text: string;
}

const SEARCH_DEBOUNCE_MS = 50;
const MAX_CONTENT_RESULTS = 200;

interface SearchWorker {
  setFiles(files: LocalFile[]): void;
  search(query: string): Promise<SearchMatch[]>;
  terminate(): void;
}

function createSearchWorker(): SearchWorker | null {
  try {
    if (typeof Worker === "undefined") return null;
    const worker = new Worker(new URL("../workers/search.worker.ts", import.meta.url));
    let seq = 0;
    const pending = new Map<number, { resolve: (v: SearchMatch[]) => void; reject: (e: Error) => void }>();
    worker.onmessage = (event: MessageEvent<{ id: number; results?: SearchMatch[] }>) => {
      const entry = pending.get(event.data?.id);
      if (!entry) return;
      pending.delete(event.data.id);
      entry.resolve(event.data.results ?? []);
    };
    return {
      setFiles(files) {
        worker.postMessage({
          type: "SET_FILES",
          files: files.map((f) => ({ id: f.id, name: f.name, content: f.content })),
        });
      },
      search(query) {
        return new Promise((resolve, reject) => {
          const id = ++seq;
          pending.set(id, { resolve, reject });
          worker.postMessage({ type: "SEARCH", id, query, max: MAX_CONTENT_RESULTS });
        });
      },
      terminate() {
        worker.terminate();
      },
    };
  } catch {
    return null;
  }
}

function searchContentSync(files: LocalFile[], query: string): SearchMatch[] {
  const q = query.toLowerCase();
  const results: SearchMatch[] = [];
  for (const f of files) {
    if (results.length >= MAX_CONTENT_RESULTS) break;
    if (!f.content) continue;
    const lines = f.content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].toLowerCase().includes(q)) {
        results.push({
          fileId: f.id,
          fileName: f.name,
          line: i + 1,
          text: lines[i].trim(),
        });
        if (results.length >= MAX_CONTENT_RESULTS) break;
      }
    }
  }
  return results;
}

export function useSearch(files: LocalFile[]) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [mode, setMode] = useState<"files" | "content">("files");
  const [open, setOpen] = useState(false);
  const [contentResults, setContentResults] = useState<SearchMatch[]>([]);
  const workerRef = useRef<SearchWorker | null>(null);

  useEffect(() => {
    if (mode !== "content") {
      setDebouncedQuery(query);
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, mode]);

  useEffect(() => {
    if (open) {
      workerRef.current?.terminate();
      workerRef.current = createSearchWorker();
    } else {
      workerRef.current?.terminate();
      workerRef.current = null;
      setContentResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (open && workerRef.current) {
      workerRef.current.setFiles(files);
    }
  }, [files, open]);

  const fileResults: FileMeta[] = useMemo(() => {
    if (!debouncedQuery.trim()) return files;
    const q = debouncedQuery.toLowerCase();
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, debouncedQuery]);

  useEffect(() => {
    if (!debouncedQuery.trim() || mode !== "content") {
      setContentResults([]);
      return;
    }
    const worker = workerRef.current;
    if (!worker) {
      setContentResults(searchContentSync(files, debouncedQuery));
      return;
    }
    let cancelled = false;
    worker.search(debouncedQuery).then((results) => {
      if (!cancelled) setContentResults(results);
    }).catch(() => {
      if (!cancelled) setContentResults(searchContentSync(files, debouncedQuery));
    });
    return () => { cancelled = true; };
  }, [files, debouncedQuery, mode]);

  const toggleOpen = useCallback(() => {
    setOpen((o) => !o);
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
    }
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }, []);

  return {
    query,
    setQuery,
    mode,
    setMode,
    open,
    setOpen,
    toggleOpen,
    close,
    fileResults,
    contentResults,
  };
}
