import { useState, useEffect, useRef } from "react";

export type SyncStatus = "idle" | "syncing" | "synced" | "failed";

export function useUI() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [saved, setSaved] = useState<boolean | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [connected, setConnected] = useState(true);
  const savedTimer = useRef<number | undefined>(undefined);
  const syncTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
      if (!e.matches) setSidebarOpen(true);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return {
    sidebarOpen, setSidebarOpen,
    isMobile,
    saved, setSaved,
    syncStatus, setSyncStatus, syncTimer,
    connected,
    savedTimer,
  };
}
