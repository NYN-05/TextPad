import { useEffect } from "react";

interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  preventDefault?: boolean;
}

export function useKeyboardShortcuts(shortcuts: Shortcut[]) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const s of shortcuts) {
        const ctrl = s.ctrl ?? false;
        const shift = s.shift ?? false;
        const alt = s.alt ?? false;
        const matchCtrl = (e.ctrlKey || e.metaKey) === ctrl;
        const matchShift = e.shiftKey === shift;
        const matchAlt = e.altKey === alt;
        const matchKey = e.key.toLowerCase() === s.key.toLowerCase();

        if (matchCtrl && matchShift && matchAlt && matchKey) {
          if (s.preventDefault ?? true) {
            e.preventDefault();
            e.stopPropagation();
          }
          s.handler();
          return;
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [shortcuts]);
}

export const SHORTCUTS = {
  newFile: { key: "n", ctrl: true },
  save: { key: "s", ctrl: true },
  openSearch: { key: "f", ctrl: true },
  openCommand: { key: "p", ctrl: true, shift: true },
  undo: { key: "z", ctrl: true },
  redo: { key: "y", ctrl: true },
  closeDialog: { key: "escape" },
  deleteFile: { key: "delete" },
  renameFile: { key: "f2" },
} as const;
