import { useMemo, useState, useEffect, useCallback } from "react";
import type { FileMeta } from "../types";
import type { SyncStatus } from "../hooks/useUI";
import type { AppSettings } from "../hooks/useSettings";
import type { Activity } from "../hooks/useActivityLog";
import type { StorageEstimate } from "../hooks/useStorageEstimate";
import { fileIcon } from "../utils/fileIcon";
import "../styles/dashboard.css";

interface DashboardProps {
  files: FileMeta[];
  cryptoStatus: string;
  syncEngineStatus: string;
  syncPendingCount: number;
  connected: boolean;
  settings: AppSettings;
  activities: Activity[];
  storageEstimate: StorageEstimate | null;
  onCreateFile: () => void;
  onOpenFile: (id: string) => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onImportFile: () => void;
  onExportBackup: () => void;
  onRestoreBackup: () => void;
}

const TIPS = [
  "Ctrl+S saves instantly to your device.",
  "Double-click a file name in the sidebar to rename it.",
  "Everything is automatically saved locally.",
  "Cloud synchronization is optional — toggle it in Settings.",
  "Your files are encrypted with AES-256-GCM at rest.",
  "Press Ctrl+F to search across all files.",
  "Press Ctrl+N to create a new file instantly.",
  "You can import existing text files into TextPad.",
];

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const activityIcon: Record<string, string> = {
  created: "+",
  renamed: "p",
  imported: "\u2191",
  backup: "\u2193",
  sync: "\u21C5",
  restore: "\u21A9",
};

function useTipRotation() {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setIndex((p) => (p + 1) % TIPS.length), 8000);
    return () => clearInterval(timer);
  }, []);
  return index;
}

function HeroSection({
  searchQuery,
  onSearchChange,
  onCreateFile,
  onImportFile,
  onExportBackup,
  onRestoreBackup,
  onSearchFocus,
  fileCount,
}: {
  searchQuery: string;
  onSearchChange: (v: string) => void;
  onCreateFile: () => void;
  onImportFile: () => void;
  onExportBackup: () => void;
  onRestoreBackup: () => void;
  onSearchFocus: () => void;
  fileCount: number;
}) {
  return (
    <div className="dash-hero">
      <div className="dash-hero-top">
        <div className="dash-hero-brand">
          <div className="dash-hero-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <h1 className="dash-hero-title">TextPad</h1>
            <p className="dash-hero-tagline">Secure Local-First Text Editor</p>
          </div>
        </div>
        <button className="dash-btn dash-btn-primary" onClick={onCreateFile}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          New File
        </button>
      </div>
      <div className="dash-search-wrap">
        <svg className="dash-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        <input
          className="dash-search-input"
          type="text"
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onFocus={onSearchFocus}
        />
        {fileCount > 0 && <span className="dash-search-count">{fileCount} file{fileCount !== 1 ? "s" : ""}</span>}
      </div>
      <div className="dash-hero-actions">
        <button className="dash-btn" onClick={onImportFile}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
          Import File
        </button>
        <button className="dash-btn" onClick={onExportBackup}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Export Backup
        </button>
        <button className="dash-btn" onClick={onRestoreBackup} title="Restore files from a JSON backup file">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
          Restore Backup
        </button>
      </div>
    </div>
  );
}

function QuickActionsRow({
  onCreateFile,
  onImportFile,
  onOpenSearch,
  onOpenSettings,
}: {
  onCreateFile: () => void;
  onImportFile: () => void;
  onOpenSearch: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="dash-quick">
      <span className="dash-quick-label">Quick Actions</span>
      <div className="dash-quick-row">
        <button className="dash-icon-btn" onClick={onCreateFile} title="New File (Ctrl+N)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
        </button>
        <button className="dash-icon-btn" onClick={onImportFile} title="Import File">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
        </button>
        <button className="dash-icon-btn" onClick={onOpenSearch} title="Search Files (Ctrl+F)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
        </button>
        <button className="dash-icon-btn" onClick={onOpenSettings} title="Settings">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
        </button>
      </div>
    </div>
  );
}

function TipPill() {
  const index = useTipRotation();
  return (
    <div className="dash-tip">
      <span className="dash-tip-bulb">*</span>
      <span className="dash-tip-text">{TIPS[index]}</span>
    </div>
  );
}

function RecentFilesSection({
  files,
  searchQuery,
  onOpenFile,
  onCreateFile,
}: {
  files: FileMeta[];
  searchQuery: string;
  onOpenFile: (id: string) => void;
  onCreateFile: () => void;
}) {
  const sorted = useMemo(() => {
    const s = [...files].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!searchQuery.trim()) return s;
    const q = searchQuery.toLowerCase();
    return s.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, searchQuery]);

  if (files.length === 0) {
    return (
      <div className="dash-section dash-recent">
        <div className="dash-section-header">
          <h2 className="dash-section-title">Recent Files</h2>
        </div>
        <div className="dash-recent-empty">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
          <p className="dash-recent-empty-text">No files yet</p>
          <button className="dash-btn dash-btn-primary" onClick={onCreateFile}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Create your first file
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-section dash-recent">
      <div className="dash-section-header">
        <h2 className="dash-section-title">Recent Files</h2>
        {sorted.length > 0 && <span className="dash-section-count">{sorted.length}</span>}
      </div>
      <div className="dash-recent-list">
        {sorted.map((f) => (
          <button key={f.id} className="dash-recent-item" onClick={() => onOpenFile(f.id)}>
            <span className="dash-recent-icon">{fileIcon(f.name)}</span>
            <span className="dash-recent-name">{f.name}</span>
            <span className="dash-recent-date">{formatDate(f.updatedAt)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ActivityDrawer({
  open,
  onClose,
  activities,
}: {
  open: boolean;
  onClose: () => void;
  activities: Activity[];
}) {
  const recent = activities.slice(0, 20);
  return (
    <>
      {open && <button className="dash-drawer-backdrop" onClick={onClose} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} aria-label="Close activity" />}
      <div className={`dash-drawer ${open ? "dash-drawer--open" : ""}`}>
        <div className="dash-drawer-header">
          <h3 className="dash-drawer-title">Activity</h3>
          <button className="dash-drawer-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <div className="dash-drawer-body">
          {recent.length === 0 ? (
            <p className="dash-drawer-empty">No activity yet</p>
          ) : (
            recent.map((a) => (
              <div key={a.id} className="dash-drawer-item">
                <span className="dash-drawer-item-icon">{activityIcon[a.type] || "\u2022"}</span>
                <div className="dash-drawer-item-info">
                  <span className="dash-drawer-item-label">{a.label}</span>
                  <span className="dash-drawer-item-time">{formatDate(a.timestamp)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

function SystemStatus({
  expanded,
  onToggle,
  files,
  storageEstimate,
  settings,
  cryptoStatus,
  syncEngineStatus,
  syncPendingCount,
  connected,
}: {
  expanded: boolean;
  onToggle: () => void;
  files: FileMeta[];
  storageEstimate: StorageEstimate | null;
  settings: AppSettings;
  cryptoStatus: string;
  syncEngineStatus: string;
  syncPendingCount: number;
  connected: boolean;
}) {
  const totalSize = useMemo(() => (storageEstimate ? formatBytes(storageEstimate.usage) : "\u2014"), [storageEstimate]);
  const lastModified = useMemo(() => {
    if (files.length === 0) return "\u2014";
    const sorted = [...files].sort((a, b) => b.updatedAt - a.updatedAt);
    return formatDate(sorted[0].updatedAt);
  }, [files]);

  const isCryptoReady = cryptoStatus === "ready";
  const isSyncConnected = connected && (syncEngineStatus === "connected" || syncEngineStatus === "connecting");
  const syncDotClass = isSyncConnected ? "green" : connected ? "gray" : "red";
  const syncLabel = isSyncConnected ? "Connected" : connected ? "Disconnected" : "Offline";

  const ua = navigator.userAgent;
  const browser = ua.includes("Edg") ? "Edge" : ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Unknown";
  const isPWA = window.matchMedia("(display-mode: standalone)").matches;

  return (
    <div className={`dash-status ${expanded ? "dash-status--open" : ""}`}>
      <button className="dash-status-toggle" onClick={onToggle}>
        <svg className="dash-status-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
        <span className="dash-status-toggle-label">System Status</span>
        <span className="dash-status-toggle-hint">{expanded ? "Collapse" : "Expand"}</span>
      </button>
      {expanded && (
        <div className="dash-status-grid">
          <div className="dash-status-group">
            <span className="dash-status-group-title">Workspace</span>
            <div className="dash-status-row"><span className="dash-status-label">Files</span><span className="dash-status-value">{files.length}</span></div>
            <div className="dash-status-row"><span className="dash-status-label">Storage Used</span><span className="dash-status-value">{totalSize}</span></div>
            <div className="dash-status-row"><span className="dash-status-label">Last Modified</span><span className="dash-status-value">{lastModified}</span></div>
            {storageEstimate && (
              <div className="dash-status-bar-wrap">
                <div className="dash-status-bar"><div className="dash-status-bar-fill" style={{ width: `${Math.min(storageEstimate.percent, 100)}%` }} /></div>
                <span className="dash-status-bar-label">{storageEstimate.percent.toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className="dash-status-group">
            <span className="dash-status-group-title">Cloud Sync</span>
            <div className="dash-status-row"><span className="dash-status-label">Status</span><span className="dash-status-value"><span className={`dash-dot ${syncDotClass}`} />{settings.cloudSync ? syncLabel : "Disabled"}</span></div>
            {settings.cloudSync && (
              <>
                <div className="dash-status-row"><span className="dash-status-label">Pending</span><span className="dash-status-value">{syncPendingCount > 0 ? <span className="dash-status-warn">{syncPendingCount} op{syncPendingCount !== 1 ? "s" : ""}</span> : "None"}</span></div>
                <div className="dash-status-row"><span className="dash-status-label">Network</span><span className="dash-status-value"><span className={`dash-dot ${connected ? "green" : "red"}`} />{connected ? "Online" : "Offline"}</span></div>
              </>
            )}
            {!settings.cloudSync && <div className="dash-status-row"><span className="dash-status-label">Note</span><span className="dash-status-value dash-status-value--muted">Enable in Settings</span></div>}
          </div>
          <div className="dash-status-group">
            <span className="dash-status-group-title">Security</span>
            <div className="dash-status-row"><span className="dash-status-label">Encryption</span><span className="dash-status-value">{isCryptoReady ? "AES-256-GCM" : settings.encryption ? "Initializing..." : "Disabled"}</span></div>
            <div className="dash-status-row"><span className="dash-status-label">Crypto</span><span className="dash-status-value"><span className={`dash-dot ${isCryptoReady ? "green" : cryptoStatus === "error" ? "red" : "gray"}`} />{isCryptoReady ? "Ready" : cryptoStatus === "error" ? "Unavailable" : "Pending"}</span></div>
            <div className="dash-status-row"><span className="dash-status-label">HTTPS</span><span className="dash-status-value"><span className={`dash-dot ${location.protocol === "https:" ? "green" : "yellow"}`} />{location.protocol === "https:" ? "Secure" : "Not Secure"}</span></div>
          </div>
          <div className="dash-status-group">
            <span className="dash-status-group-title">Device</span>
            <div className="dash-status-row"><span className="dash-status-label">Browser</span><span className="dash-status-value">{browser}</span></div>
            <div className="dash-status-row"><span className="dash-status-label">Storage API</span><span className="dash-status-value"><span className={`dash-dot ${"storage" in navigator && navigator.storage ? "green" : "red"}`} />{"storage" in navigator && navigator.storage ? "Available" : "N/A"}</span></div>
            <div className="dash-status-row"><span className="dash-status-label">PWA</span><span className="dash-status-value"><span className={`dash-dot ${isPWA ? "green" : "gray"}`} />{isPWA ? "Installed" : "Not Installed"}</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Dashboard(props: DashboardProps) {
  const { files, onCreateFile } = props;
  const [searchQuery, setSearchQuery] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);

  const handleSearchFocus = useCallback(() => {
    props.onOpenSearch();
  }, [props.onOpenSearch]);

  return (
    <div className="dash">
      <div className="dash-layout">
        <HeroSection
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCreateFile={onCreateFile}
          onImportFile={props.onImportFile}
          onExportBackup={props.onExportBackup}
          onRestoreBackup={props.onRestoreBackup}
          onSearchFocus={handleSearchFocus}
          fileCount={files.length}
        />

        <div className="dash-main">
          <div className="dash-main-primary">
            <RecentFilesSection
              files={files}
              searchQuery={searchQuery}
              onOpenFile={props.onOpenFile}
              onCreateFile={onCreateFile}
            />
          </div>

          <div className="dash-main-side">
            <QuickActionsRow
              onCreateFile={onCreateFile}
              onImportFile={props.onImportFile}
              onOpenSearch={props.onOpenSearch}
              onOpenSettings={props.onOpenSettings}
            />

            <button className="dash-activity-btn" onClick={() => setActivityOpen((o) => !o)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              <span>Activity</span>
              {props.activities.length > 0 && <span className="dash-activity-badge">{props.activities.length}</span>}
            </button>

            <TipPill />
          </div>
        </div>

        <SystemStatus
          expanded={statusOpen}
          onToggle={() => setStatusOpen((o) => !o)}
          files={files}
          storageEstimate={props.storageEstimate}
          settings={props.settings}
          cryptoStatus={props.cryptoStatus}
          syncEngineStatus={props.syncEngineStatus}
          syncPendingCount={props.syncPendingCount}
          connected={props.connected}
        />
      </div>

      <ActivityDrawer
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        activities={props.activities}
      />
    </div>
  );
}
