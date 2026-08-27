import { memo, useMemo } from "react";
import type { FileData } from "../types";
import type { SyncStatus } from "../hooks/useUI";
import "../styles/statusbar.css";

interface Props {
  file: FileData | null;
  saved: boolean | null;
  syncStatus: SyncStatus;
  connected: boolean;
  cryptoReady?: boolean;
  pendingOps?: number;
  storageUsage?: string;
}

function StatusBarInner({ file, saved, syncStatus, connected, cryptoReady, pendingOps = 0, storageUsage }: Props) {
  const stats = useMemo(() => {
    if (!file?.content) return null;
    const c = file.content;
    return {
      lines: c.split("\n").length,
      words: c.trim() ? c.trim().split(/\s+/).length : 0,
      chars: c.length,
    };
  }, [file?.content]);

  const localIndicator = (() => {
    if (saved === null) return { label: "Local", className: "", dot: "gray" as const };
    if (saved) return { label: "Saved", className: "statusbar-saved", dot: "green" as const };
    return { label: "Saving...", className: "statusbar-unsaved", dot: "yellow" as const };
  })();

  const syncIndicator = (() => {
    if (!connected) return { label: "Offline", className: "", dot: "gray" as const };
    if (syncStatus === "syncing") return { label: "Syncing...", className: "statusbar-unsaved", dot: "yellow" as const };
    if (syncStatus === "synced") return { label: "Synced", className: "statusbar-saved", dot: "green" as const };
    if (syncStatus === "failed") return { label: "Failed", className: "statusbar-failed", dot: "red" as const };
    return { label: "Cloud", className: "", dot: "gray" as const };
  })();

  return (
    <div className="statusbar" role="status" aria-label="Status bar">
      <div className="statusbar-left">
        <span className="statusbar-item">UTF-8</span>
        {stats && (
          <>
            <div className="statusbar-spacer" />
            <span className="statusbar-item hide-mobile">{stats.lines} lines</span>
            <span className="statusbar-item hide-mobile">{stats.words} words</span>
            <span className="statusbar-item hide-mobile">{stats.chars} chars</span>
          </>
        )}
        <div className="statusbar-spacer" />
        <span className="statusbar-item hide-mobile">{storageUsage || "—"}</span>
      </div>
      <div className="statusbar-right">
        <span className={`statusbar-item ${localIndicator.className}`}>
          <span className={`statusbar-dot ${localIndicator.dot}`} />
          {localIndicator.label}
        </span>

        {cryptoReady !== undefined && (
          <span className={`statusbar-item ${cryptoReady ? "statusbar-saved" : ""}`}>
            <span className={`statusbar-dot ${cryptoReady ? "green" : "gray"}`} />
            {cryptoReady ? "Encrypted" : "Plain"}
          </span>
        )}

        <div className="statusbar-spacer" />

        <span className={`statusbar-item ${syncIndicator.className}`}>
          <span className={`statusbar-dot ${syncIndicator.dot}`} />
          {syncIndicator.label}
        </span>

        {pendingOps > 0 && (
          <span className="statusbar-item statusbar-unsaved" title="Pending sync operations">
            ● {pendingOps}
          </span>
        )}

        <span className="statusbar-item hide-mobile">v1.0</span>
      </div>
    </div>
  );
}

export default memo(StatusBarInner);
