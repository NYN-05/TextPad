import { memo, useCallback, useRef, useEffect } from "react";
import type { FileMeta } from "../types";
import type { SearchMatch } from "../hooks/useSearch";
import "../styles/search.css";

interface Props {
  open: boolean;
  query: string;
  mode: "files" | "content";
  fileResults: FileMeta[];
  contentResults: SearchMatch[];
  onQueryChange: (q: string) => void;
  onModeChange: (mode: "files" | "content") => void;
  onClose: () => void;
  onSelectFile: (id: string) => void;
}

function SearchPanelInner({ open, query, mode, fileResults, contentResults, onQueryChange, onModeChange, onClose, onSelectFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  if (!open) return null;

  const results = mode === "files" ? fileResults : contentResults;
  const count = results.length;

  return (
    <div className="search-overlay" role="dialog" aria-label="Search">
      <div className="search-header">
        <input
          ref={inputRef}
          className="search-input"
          placeholder={mode === "files" ? "Search files..." : "Search content..."}
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={handleKey}
          aria-label="Search input"
        />
        <button
          className={`search-mode-btn ${mode === "files" ? "active" : ""}`}
          onClick={() => onModeChange("files")}
          aria-label="Search files"
        >
          Files
        </button>
        <button
          className={`search-mode-btn ${mode === "content" ? "active" : ""}`}
          onClick={() => onModeChange("content")}
          aria-label="Search content"
        >
          Content
        </button>
        <span className="search-count">{count > 0 ? `${count}` : ""}</span>
        <button className="search-close" onClick={onClose} aria-label="Close search">✕</button>
      </div>
      <div className="search-results" role="listbox" aria-label={mode === "files" ? "File search results" : "Content search results"}>
        {mode === "files" && fileResults.map((f) => (
          <div
            key={f.id}
            className="search-result-item"
            onClick={() => { onSelectFile(f.id); onClose(); }}
            role="option"
            aria-selected="false"
          >
            <span className="search-result-name">{f.name}</span>
          </div>
        ))}
        {mode === "content" && contentResults.map((m, i) => (
          <div
            key={`${m.fileId}-${m.line}-${i}`}
            className="search-result-item"
            onClick={() => { onSelectFile(m.fileId); onClose(); }}
            role="option"
            aria-selected="false"
          >
            <span className="search-result-name">{m.fileName}</span>
            <span className="search-result-line">:{m.line}</span>
            <span className="search-result-text">{m.text}</span>
          </div>
        ))}
        {query.trim() && count === 0 && (
          <div className="search-empty">No results found</div>
        )}
      </div>
    </div>
  );
}

export default memo(SearchPanelInner);
