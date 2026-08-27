import { useState, useEffect, useCallback } from "react";
import { setEncryptionEnabled } from "../crypto/crypto-init";

export interface AppSettings {
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
  cloudSync: boolean;
  encryption: boolean;
  syncPassphrase: string;
  theme: "dark" | "light";
  restoreSession: boolean;
}

const DEFAULTS: AppSettings = {
  fontSize: 14,
  fontFamily: "JetBrains Mono",
  tabSize: 2,
  wordWrap: false,
  autoSave: true,
  autoSaveDelay: 500,
  cloudSync: false,
  encryption: true,
  syncPassphrase: "",
  theme: "dark",
  restoreSession: false,
};

const STORAGE_KEY = "textpad-settings";

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULTS, ...parsed };
    }
  } catch {}
  return { ...DEFAULTS };
}

function saveSettings(settings: AppSettings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {}
}

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    saveSettings(settings);
    document.documentElement.style.setProperty("--editor-font-size", `${settings.fontSize}px`);
    document.documentElement.style.setProperty("--editor-tab-size", String(settings.tabSize));
    document.documentElement.style.setProperty("--editor-font-family", settings.fontFamily);
    document.documentElement.style.setProperty("--editor-white-space", settings.wordWrap ? "pre-wrap" : "pre");
    document.documentElement.setAttribute("data-theme", settings.theme);
    setEncryptionEnabled(settings.encryption);
  }, [settings]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings({ ...DEFAULTS });
  }, []);

  return { settings, updateSetting, resetSettings };
}
