import { useState, useMemo, memo, useCallback, useEffect, useRef } from "react";
import type { FileMeta } from "../types";
import { fileIcon } from "../utils/fileIcon";
import ContextMenu from "./ContextMenu";
import type { ContextMenuItem } from "./ContextMenu";
import "../styles/sidebar.css";

interface Props {
  open: boolean;
  isMobile: boolean;
  files: FileMeta[];
  activeId: string | null;
  scrollToId?: string | null;
  unsavedIds: Set<string>;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onToggle: () => void;
  onDashboard?: () => void;
  showDashboardLink?: boolean;
}

const FileRow = memo(function FileRow({ f, active, editing, editName, unsaved, onSelect, onDelete, onDuplicate, onStartRename, onEditChange, onEditBlur, onEditKey, onContextMenu, isMobile }: {
  f: FileMeta;
  active: boolean;
  editing: boolean;
  editName: string;
  unsaved: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onStartRename: () => void;
  onEditChange: (v: string) => void;
  onEditBlur: () => void;
  onEditKey: (e: React.KeyboardEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  isMobile: boolean;
}) {
  if (editing) {
    return (
      <div className={isMobile ? "sidebar-mob-edit-row" : "sidebar-edit-row"}>
        <input
          className={isMobile ? "sidebar-mob-input" : "sidebar-finput"}
          autoFocus
          value={editName}
          onChange={(e) => onEditChange(e.target.value)}
          onBlur={onEditBlur}
          onKeyDown={onEditKey}
          aria-label="File name"
        />
        <button
          className={isMobile ? "sidebar-mob-del" : "sidebar-del"}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label={`Delete ${f.name}`}
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div
      className={`${isMobile ? "sidebar-mob-item" : "sidebar-item"} ${active ? "active" : ""}`}
      onContextMenu={onContextMenu}
      role="listitem"
      data-context-id={f.id}
    >
      <span className="sidebar-ficon">{fileIcon(f.name)}</span>
      <button
        className={isMobile ? "sidebar-mob-name" : "sidebar-fname"}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSelect(); }}}
        title="Open file"
      >
        {f.name}
      </button>
      {unsaved && <span className="sidebar-modified" title="Unsaved changes">●</span>}
      <button
        className={isMobile ? "sidebar-mob-rename" : "sidebar-rename"}
        onClick={(e) => { e.stopPropagation(); onStartRename(); }}
        aria-label={`Rename ${f.name}`}
        title="Rename"
      >
        ✎
      </button>
      <button
        className={isMobile ? "sidebar-mob-del" : "sidebar-del"}
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={`Delete ${f.name}`}
      >
        ×
      </button>
    </div>
  );
});

const emptyArr: FileMeta[] = [];

function SidebarInner({ open, isMobile, files, activeId, scrollToId, unsavedIds, onSelect, onCreate, onDelete, onDuplicate, onRename, onToggle, onDashboard, showDashboardLink }: Props) {
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [search, setSearch] = useState("");
  const [ctxMenu, setCtxMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!scrollToId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-file-id="${scrollToId}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [scrollToId]);

  const closeCtx = useCallback(() => setCtxMenu(null), []);

  const startRename = useCallback((f: FileMeta) => {
    setEditing(f.id);
    setEditName(f.name);
    setCtxMenu(null);
  }, []);

  const finishRename = useCallback((id: string) => {
    if (editName.trim()) onRename(id, editName.trim());
    setEditing(null);
  }, [editName, onRename]);

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const id = (e.currentTarget as HTMLElement).getAttribute("data-context-id");
    if (id) setCtxMenu({ id, x: e.clientX, y: e.clientY });
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => f.name.toLowerCase().includes(q));
  }, [files, search]);

  const list = filtered.length ? filtered : emptyArr;

  const ctxItems: ContextMenuItem[] = ctxMenu ? [
    { label: "Rename", icon: "✎", shortcut: "F2", action: () => { const f = files.find((x) => x.id === ctxMenu.id); if (f) startRename(f); } },
    { label: "Duplicate", icon: "⧉", action: () => onDuplicate(ctxMenu.id) },
    { label: "", separator: true, action: () => {} },
    { label: "Delete", icon: "×", danger: true, shortcut: "Del", action: () => onDelete(ctxMenu.id) },
  ] : [];

  const createNew = useCallback(() => {
    onCreate();
    setSearch("");
  }, [onCreate]);

  const headerContent = (
    <>
      <div className={isMobile ? "sidebar-mob-header" : "sidebar-head"}>
        <span className={isMobile ? "sidebar-mob-title" : "sidebar-title"}>
          <svg className="sidebar-title-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c5cfc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="sidebar-title-text">Explorer</span>
        </span>
        {!isMobile && (
          <button className="sidebar-collapse" onClick={onToggle} aria-label="Collapse sidebar" title="Collapse sidebar">◀</button>
        )}
        {isMobile && (
          <button className="sidebar-mob-close" onClick={onToggle} aria-label="Close sidebar">✕</button>
        )}
      </div>
      {showDashboardLink && onDashboard && (
        <div className="sidebar-nav">
          <button className="sidebar-nav-item" onClick={() => { onDashboard(); if (isMobile) onToggle(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
            </svg>
            Dashboard
          </button>
        </div>
      )}
      <div className={isMobile ? "sidebar-mob-tools" : "sidebar-tools"}>
        <div className="sidebar-search-box">
          <span className="sidebar-search-icon">⌕</span>
          <input
            className="sidebar-search-input"
            placeholder="Search files..."
            value={search}
            onChange={handleSearch}
            aria-label="Search files"
          />
        </div>
        <button className="sidebar-new-btn" onClick={createNew} aria-label="Create new file" title="New File">+</button>
      </div>
      <div className="sidebar-section">
        <span className="sidebar-section-label">Files</span>
        <span className="sidebar-section-count">{files.length}</span>
      </div>
    </>
  );

  const fileList = (
    <div className={isMobile ? "sidebar-mob-list" : "sidebar-list sidebar-scroll"} ref={listRef}>
      {list.map((f) => (
        <div key={f.id} data-file-id={f.id} className="sidebar-file-row">
          <FileRow
            f={f}
            active={activeId === f.id}
            editing={editing === f.id}
            editName={editName}
            unsaved={unsavedIds.has(f.id)}
            isMobile={isMobile}
            onSelect={() => { onSelect(f.id); if (isMobile) onToggle(); }}
            onDelete={() => onDelete(f.id)}
            onDuplicate={() => onDuplicate(f.id)}
            onStartRename={() => startRename(f)}
            onEditChange={setEditName}
            onEditBlur={() => finishRename(f.id)}
            onEditKey={(e) => e.key === "Enter" && finishRename(f.id)}
            onContextMenu={handleContextMenu}
          />
        </div>
      ))}
      {list.length === 0 && (
        <div className="sidebar-empty">
          {search ? "No files match your search" : "No files yet"}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <>
        <div className={`sidebar-mob-drawer ${open ? "open" : "close"}`}>
          {headerContent}
          {fileList}
        </div>
        {ctxMenu && <ContextMenu items={ctxItems} position={{ x: ctxMenu.x, y: ctxMenu.y }} onClose={closeCtx} />}
      </>
    );
  }

  return (
    <div className={`sidebar ${open ? "open" : "close"}`}>
      {headerContent}
      {fileList}
      {ctxMenu && <ContextMenu items={ctxItems} position={{ x: ctxMenu.x, y: ctxMenu.y }} onClose={closeCtx} />}
    </div>
  );
}

export default memo(SidebarInner);
