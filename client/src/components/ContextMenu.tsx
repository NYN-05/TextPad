import { useEffect, useRef, useState, memo, useCallback, useMemo } from "react";
import "../styles/context-menu.css";

export interface ContextMenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  danger?: boolean;
  separator?: boolean;
  action: () => void;
}

interface Props {
  items: ContextMenuItem[];
  position: { x: number; y: number };
  onClose: () => void;
}

function ContextMenuInner({ items, position, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  const adjustedPos = useMemo(() => {
    if (!ref.current) return position;
    const rect = ref.current.getBoundingClientRect();
    const adj = { ...position };
    if (position.x + rect.width > window.innerWidth) {
      adj.x = window.innerWidth - rect.width - 8;
    }
    if (position.y + rect.height > window.innerHeight) {
      adj.y = window.innerHeight - rect.height - 8;
    }
    return adj;
  }, [position]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      <button className="ctx-overlay" onClick={onClose} onKeyDown={(e) => { if (e.key === "Escape") onClose(); }} onContextMenu={(e) => { e.preventDefault(); onClose(); }} aria-label="Close menu" />
      <div
        ref={ref}
        className="ctx-menu"
        style={{ left: adjustedPos.x, top: adjustedPos.y }}
        role="menu"
      >
        {items.map((item, i) => {
          if (item.separator) {
            return <div key={i} className="ctx-separator" />;
          }
          return (
            <button
              key={i}
              className={`ctx-item ${item.danger ? "ctx-item-danger" : ""}`}
              onClick={() => { item.action(); onClose(); }}
              role="menuitem"
            >
              {item.icon && <span className="ctx-icon">{item.icon}</span>}
              <span className="ctx-label">{item.label}</span>
              {item.shortcut && <span className="ctx-shortcut">{item.shortcut}</span>}
            </button>
          );
        })}
      </div>
    </>
  );
}

export default memo(ContextMenuInner);
