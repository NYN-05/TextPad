import { memo } from "react";
import "../styles/toolbar.css";

interface Props {
  sidebarOpen: boolean;
  isMobile: boolean;
  onToggleSidebar: () => void;
  onCreateFile: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
  syncStatus: string;
  onDashboard?: () => void;
}

function ToolbarInner({ sidebarOpen, isMobile, onToggleSidebar, onCreateFile, onOpenSearch, onOpenSettings, syncStatus, onDashboard }: Props) {
  const showToggle = isMobile || !sidebarOpen;

  const syncDot = syncStatus === "syncing" ? "syncing" : syncStatus === "synced" ? "synced" : syncStatus === "failed" ? "failed" : "";

  return (
    <div className="toolbar" role="navigation" aria-label="Main navigation">
      <div className="toolbar-left">
        {showToggle && (
          <button
            className="toolbar-btn"
            onClick={onToggleSidebar}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? "✕" : "☰"}
          </button>
        )}
        <span className="toolbar-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#7c5cfc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          TextPad
        </span>
        {onDashboard && (
          <>
            <div className="toolbar-divider" />
            <button className="toolbar-action" onClick={onDashboard} aria-label="Dashboard" title="Dashboard (Ctrl+Shift+D)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
              </svg>
              <span>Dashboard</span>
            </button>
          </>
        )}
      </div>

      <div className="toolbar-center">
        <div className="toolbar-divider" />
        <button className="toolbar-action" onClick={onCreateFile} aria-label="Create new file" title="New File (Ctrl+N)">
          <span>+</span><span>New File</span>
        </button>
      </div>

      <div className="toolbar-right">
        <button
          className="toolbar-icon-btn desktop-only"
          onClick={onOpenSearch}
          aria-label="Search"
          title="Search (Ctrl+F)"
        >
          ⌕
        </button>
        <button
          className="toolbar-icon-btn"
          onClick={onOpenSettings}
          aria-label="Settings"
          title="Settings"
        >
          ⚙
        </button>
        <div className="toolbar-divider" />
        <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
          <span className="toolbar-icon-btn" style={{ cursor: "default", opacity: 0.6 }} title={`Sync: ${syncStatus}`}>
            ⇅
          </span>
          {syncDot && <span className={`toolbar-sync-dot ${syncDot}`} />}
        </div>
      </div>
    </div>
  );
}

export default memo(ToolbarInner);
