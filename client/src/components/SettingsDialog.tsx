import { memo, useEffect, useRef, useCallback } from "react";
import type { AppSettings } from "../hooks/useSettings";
import "../styles/settings.css";

interface Props {
  open: boolean;
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  onReset: () => void;
  onClose: () => void;
}

function SettingsDialogInner({ open, settings, onUpdate, onReset, onClose }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && dialogRef.current) {
      const firstInput = dialogRef.current.querySelector("input, select") as HTMLElement | null;
      firstInput?.focus();
    }
  }, [open]);

  const handleOverlay = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <div className="settings-overlay" onClick={handleOverlay} role="dialog" aria-label="Settings">
      <div className="settings-dialog" ref={dialogRef} onKeyDown={handleKey}>
        <div className="settings-header">
          <span className="settings-title">Settings</span>
          <button className="settings-close" onClick={onClose} aria-label="Close settings">✕</button>
        </div>
        <div className="settings-body">
          <div className="settings-group">
            <span className="settings-label">Editor</span>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Font Size</div>
                <div className="settings-row-desc">{settings.fontSize}px</div>
              </div>
              <input
                type="range"
                className="settings-range"
                min={10}
                max={24}
                step={1}
                value={settings.fontSize}
                onChange={(e) => onUpdate("fontSize", Number(e.target.value))}
                aria-label="Font size"
              />
            </div>
            <div className="settings-row">
              <div className="settings-row-label">Font Family</div>
              <select
                className="settings-select"
                value={settings.fontFamily}
                onChange={(e) => onUpdate("fontFamily", e.target.value)}
                aria-label="Font family"
              >
                <option value="JetBrains Mono">JetBrains Mono</option>
                <option value="Fira Code">Fira Code</option>
                <option value="Inter">Inter</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">Tab Size</div>
              <select
                className="settings-select"
                value={settings.tabSize}
                onChange={(e) => onUpdate("tabSize", Number(e.target.value))}
                aria-label="Tab size"
              >
                <option value={2}>2</option>
                <option value={4}>4</option>
                <option value={8}>8</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-row-label">Word Wrap</div>
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.wordWrap}
                onChange={(e) => onUpdate("wordWrap", e.target.checked)}
                aria-label="Word wrap"
              />
            </div>
          </div>

          <div className="settings-group">
            <span className="settings-label">Saving</span>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Autosave</div>
                <div className="settings-row-desc">{settings.autoSaveDelay}ms delay</div>
              </div>
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.autoSave}
                onChange={(e) => onUpdate("autoSave", e.target.checked)}
                aria-label="Autosave"
              />
            </div>
          </div>

          <div className="settings-group">
            <span className="settings-label">Appearance</span>
            <div className="settings-row">
              <div className="settings-row-label">Theme</div>
              <select
                className="settings-select"
                value={settings.theme}
                onChange={(e) => onUpdate("theme", e.target.value as "dark" | "light")}
                aria-label="Theme"
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>

          <div className="settings-group">
            <span className="settings-label">Sync</span>
            <div className="settings-row">
              <div className="settings-row-label">Cloud Sync</div>
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.cloudSync}
                onChange={(e) => onUpdate("cloudSync", e.target.checked)}
                aria-label="Cloud sync"
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Sync Passphrase</div>
                <div className="settings-row-desc">Shared across devices; required for multi-device sync. Set before first sync.</div>
              </div>
              <input
                type="password"
                className="settings-input"
                value={settings.syncPassphrase}
                onChange={(e) => onUpdate("syncPassphrase", e.target.value)}
                aria-label="Sync passphrase"
              />
            </div>
            <div className="settings-row">
              <div className="settings-row-label">Encryption</div>
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.encryption}
                onChange={(e) => onUpdate("encryption", e.target.checked)}
                aria-label="Encryption"
              />
            </div>
            <div className="settings-row">
              <div>
                <div className="settings-row-label">Restore Session</div>
                <div className="settings-row-desc">Reopen last file on startup</div>
              </div>
              <input
                type="checkbox"
                className="settings-checkbox"
                checked={settings.restoreSession}
                onChange={(e) => onUpdate("restoreSession", e.target.checked)}
                aria-label="Restore session"
              />
            </div>
          </div>
        </div>
        <div className="settings-footer">
          <button className="settings-btn" onClick={onReset} aria-label="Reset settings">Reset Defaults</button>
          <button className="settings-btn settings-btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

export default memo(SettingsDialogInner);
