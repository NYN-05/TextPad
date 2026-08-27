import { useState, useCallback } from "react";
import type { FileData } from "../types";

export function useActiveFile() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [fileData, setFileData] = useState<FileData | null>(null);

  const loadFile = useCallback(async (_id: string) => {
    // No-op: file content is loaded via useFileStore.loadFileContent
    // This is kept for backward compatibility
  }, []);

  const unloadFile = useCallback(() => {
    setActiveId(null);
    setFileData(null);
  }, []);

  return { activeId, setActiveId, fileData, setFileData, loadFile, unloadFile };
}
