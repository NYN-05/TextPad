import { useState, useEffect, useRef, useCallback, memo } from "react";
import type { FileData, FileStats } from "../types";
import "../styles/editor.css";

interface Props {
  file: FileData | null;
  onChange: (content: string) => void;
  onBlur?: () => void;
  onCreateFile: () => void;
}

const MAX_HISTORY = 100;
const STATS_THROTTLE_MS = 400;

function EditorInner({ file, onChange, onBlur, onCreateFile }: Props) {
  const [content, setContent] = useState("");
  const [stats, setStats] = useState<FileStats>({ lines: 0, words: 0, chars: 0 });
  const timer = useRef<number | undefined>(undefined);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastStatsAt = useRef(0);

  const historyRef = useRef<string[]>([]);
  const historyIdx = useRef(-1);
  const ignoreNext = useRef(false);

  useEffect(() => {
    setContent(file?.content ?? "");
    historyRef.current = file?.content ? [file.content] : [];
    historyIdx.current = file?.content ? 0 : -1;
    if (file?.content) {
      const c = file.content;
      setStats({
        lines: c.split("\n").length,
        words: c.trim() ? c.trim().split(/\s+/).length : 0,
        chars: c.length,
      });
    } else {
      setStats({ lines: 0, words: 0, chars: 0 });
    }
    lastStatsAt.current = 0;
  }, [file]);

  const computeStats = useCallback((val: string): FileStats => ({
    lines: val.split("\n").length,
    words: val.trim() ? val.trim().split(/\s+/).length : 0,
    chars: val.length,
  }), []);

  const maybeUpdateStats = useCallback((value: string) => {
    const now = performance.now();
    if (now - lastStatsAt.current < STATS_THROTTLE_MS) return;
    lastStatsAt.current = now;
    setStats(computeStats(value));
  }, [computeStats]);

  const pushHistory = useCallback((val: string) => {
    const h = historyRef.current;
    const idx = historyIdx.current;
    if (idx < h.length - 1) h.length = idx + 1;
    h.push(val);
    if (h.length > MAX_HISTORY) h.shift();
    historyIdx.current = h.length - 1;
  }, []);

  const handleChange = useCallback((value: string) => {
    setContent(value);
    maybeUpdateStats(value);
    if (!ignoreNext.current) pushHistory(value);
    ignoreNext.current = false;

    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(value), 400);
  }, [onChange, pushHistory, maybeUpdateStats]);

  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (historyIdx.current <= 0) return;
    historyIdx.current--;
    ignoreNext.current = true;
    const val = h[historyIdx.current];
    setContent(val);
    maybeUpdateStats(val);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(val), 400);
  }, [onChange, maybeUpdateStats]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (historyIdx.current >= h.length - 1) return;
    historyIdx.current++;
    ignoreNext.current = true;
    const val = h[historyIdx.current];
    setContent(val);
    maybeUpdateStats(val);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => onChange(val), 400);
  }, [onChange, maybeUpdateStats]);

  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);

  useEffect(() => {
    redoRef.current = redo;
  }, [redo]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        e.shiftKey ? redoRef.current() : undoRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redoRef.current();
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, []);

  if (!file) {
    return (
      <div className="editor-empty">
        <div className="editor-empty-icon">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <line x1="10" y1="9" x2="8" y2="9" />
          </svg>
        </div>
        <div className="editor-empty-title">Welcome to TextPad</div>
        <div className="editor-empty-sub">
          Create a new file to start writing, or select an existing file from the sidebar.
        </div>
        <div className="editor-empty-actions">
          <button className="editor-empty-btn" onClick={onCreateFile} aria-label="Create new file">
            <span>+</span><span>New File</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="editor-wrap">
      <div className="editor-bar">
        <span className="editor-bar-name">{file.name}</span>
        <div className="editor-bar-stats">
          <span className="editor-bar-stat">{stats.lines} lines</span>
          <span className="editor-bar-stat">{stats.words} words</span>
          <span className="editor-bar-stat">{stats.chars} chars</span>
        </div>
      </div>
      <textarea
        ref={textareaRef}
        className="editor-area"
        value={content}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={onBlur}
        spellCheck={false}
        aria-label="File content editor"
      />
    </div>
  );
}

export default memo(EditorInner);
