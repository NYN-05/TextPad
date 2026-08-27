import { useState, useEffect, useCallback } from "react";
import type { LocalFile, FileMeta } from "../db";
import { getAllFiles, getAllFilesMeta, getFile } from "../db";

export function useFileStore() {
  const [files, setFiles] = useState<LocalFile[]>([]);
  const [meta, setMeta] = useState<FileMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [metaLoaded, setMetaLoaded] = useState(false);

  const loadMeta = useCallback(async () => {
    const all = await getAllFilesMeta();
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    setMeta(all);
    setMetaLoaded(true);
    return all;
  }, []);

  const loadFiles = useCallback(async () => {
    const all = await getAllFiles();
    all.sort((a, b) => b.updatedAt - a.updatedAt);
    setFiles(all);
    setLoading(false);
    return all;
  }, []);

  const loadFileContent = useCallback(async (id: string): Promise<LocalFile | undefined> => {
    const existing = files.find(f => f.id === id);
    if (existing?.content !== undefined) return existing;
    const file = await getFile(id);
    if (file) {
      setFiles(prev => {
        const idx = prev.findIndex(f => f.id === id);
        if (idx === -1) return [...prev, file];
        const next = [...prev];
        next[idx] = file;
        return next;
      });
    }
    return file;
  }, [files]);

  const updateFileInCache = useCallback((id: string, patch: Partial<LocalFile>) => {
    setFiles(prev => {
      const idx = prev.findIndex(f => f.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
    setMeta(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
  }, []);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  return { files, meta, loading, metaLoaded, loadFiles, loadMeta, loadFileContent, updateFileInCache };
}
