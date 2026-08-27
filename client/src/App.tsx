import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { updateFile, getFile, getAllFiles, addFile, createFile as dbCreate, deleteFile as dbDelete, countFiles } from "./db";
import { useFileStore } from "./hooks/useFileStore";
import { useActiveFile } from "./hooks/useActiveFile";
import { useUI } from "./hooks/useUI";
import { useCrypto } from "./hooks/useCrypto";
import { useAutosave } from "./hooks/useAutosave";
import { useSettings } from "./hooks/useSettings";
import { useSearch } from "./hooks/useSearch";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useActivityLog } from "./hooks/useActivityLog";
import { useStorageEstimate } from "./hooks/useStorageEstimate";
import { getPendingOps } from "./db";
import { deriveGroupId } from "./crypto/group";
import type { SyncEngine } from "./sync/engine";
import Sidebar from "./components/Sidebar";
import Toolbar from "./components/Toolbar";
import StatusBar from "./components/StatusBar";
import SearchPanel from "./components/SearchPanel";
import SettingsDialog from "./components/SettingsDialog";
import ToastInner, { showToast } from "./components/Toast";
import Dashboard from "./components/Dashboard";
import LoadingScreen from "./components/LoadingScreen";
import NoFileSelected from "./components/NoFileSelected";
import OnboardingWizard from "./components/OnboardingWizard";
import LandingPage from "./components/LandingPage";
import NotFound from "./components/NotFound";
import ConfirmDialog from "./components/ConfirmDialog";
import type { OnboardingData } from "./components/OnboardingWizard";
import "./styles/app.css";

const Editor = lazy(() => import("./components/Editor"));

type ViewState = "landing" | "loading" | "dashboard" | "editor" | "notfound";

const SESSION_KEY = "textpad-last-file";
const API_BASE = import.meta.env.VITE_API_URL ?? "";

function AppInner() {
  const { files, meta, metaLoaded, loading, loadFileContent, loadFiles, loadMeta, updateFileInCache } = useFileStore();
  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const [unsavedIds, setUnsavedIds] = useState<Set<string>>(new Set());
  const { activeId, fileData, setFileData, setActiveId, loadFile, unloadFile } = useActiveFile();
  const { sidebarOpen, setSidebarOpen, isMobile, saved, setSaved, syncStatus, setSyncStatus, syncTimer, connected, savedTimer } = useUI();
  const { settings, updateSetting, resetSettings } = useSettings();
  const { status: cryptoStatus } = useCrypto(settings.syncPassphrase);
  const search = useSearch(files);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [view, setView] = useState<ViewState>("landing");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const engineRef = useRef<SyncEngine | null>(null);
  const initRef = useRef(false);
  const activeIdRef = useRef(activeId);
  const loadFileRef = useRef(loadFile);
  const savedRef = useRef(saved);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const prevViewRef = useRef(view);

  useEffect(() => { activeIdRef.current = activeId; }, [activeId]);
  useEffect(() => { loadFileRef.current = loadFile; }, [loadFile]);
  useEffect(() => { savedRef.current = saved; }, [saved]);
  useEffect(() => { prevViewRef.current = view; }, [view]);

  const [confirmState, setConfirmState] = useState<{ fileId: string; fileName: string } | null>(null);
  const [pendingOpsCount, setPendingOpsCount] = useState(0);
  const { activities, addActivity } = useActivityLog();
  const { estimate: storageEstimate } = useStorageEstimate();
  const isInitialLoad = prevViewRef.current === "landing" && view !== "landing";

  const navigateToDashboard = useCallback(() => {
    unloadFile();
    setView("dashboard");
  }, [unloadFile]);

  const onGetStarted = useCallback(() => {
    setView("loading");
  }, []);

  useKeyboardShortcuts([
    { key: "Enter", handler: () => { if (view === "landing") onGetStarted(); } },

    { key: "n", ctrl: true, handler: () => { createFile(); } },
    { key: "s", ctrl: true, handler: () => { if (activeIdRef.current) flushSave().then(() => doSync(activeIdRef.current!)); } },
    { key: "f", ctrl: true, handler: () => { search.toggleOpen(); } },
    { key: "p", ctrl: true, shift: true, handler: () => { search.toggleOpen(); } },
    { key: "d", ctrl: true, shift: true, handler: () => { navigateToDashboard(); } },
    { key: "escape", handler: () => { if (search.open) search.close(); if (settingsOpen) setSettingsOpen(false); } },
  ]);

  const { schedule: scheduleSave, flush: flushSave } = useAutosave(async (content: string) => {
    const id = activeIdRef.current;
    if (!id) return;
    const now = Date.now();
    await updateFile(id, { content, updatedAt: now });
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(null), 3000);
    setUnsavedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
    updateFileInCache(id, { content, updatedAt: now });
    if (settings.cloudSync) {
      const f = await getFile(id);
      if (f) await engineRef.current?.enqueue(f);
    }
  }, settings.autoSave ? settings.autoSaveDelay : 999999);

  const doSync = useCallback(async (id: string) => {
    if (!settings.cloudSync) return;
    const f = await getFile(id);
    if (!f) return;
    await engineRef.current?.enqueue(f);
    setSyncStatus(() => "syncing");
    const res = await engineRef.current?.flush();
    setSyncStatus(() => (res?.ok ? "synced" : "failed"));
    clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => setSyncStatus((s) => (s === "synced" || s === "failed" ? "idle" : s)), 3000);
  }, [settings.cloudSync, setSyncStatus, syncTimer]);

  useEffect(() => {
    if (view === "landing") return;
    if (initRef.current) return;
    initRef.current = true;

    let cancelled = false;
    const init = async () => {
      await Promise.all([
        loadFiles(), // background load full files for search/sync
      ]);
      if (cancelled) return;
      const onboardingDone = localStorage.getItem("textpad-onboarding-completed");
      setShowOnboarding(!onboardingDone);

      const cnt = await countFiles();
      if (cnt === 0) {
        const created = await dbCreate("untitled.txt");
        await loadFiles();
        addActivity("created", `Created "${created.name}"`);
      }
      if (!cancelled) setView("dashboard");
    };
    init().catch((err) => {
      if (cancelled) return;
      console.error("Failed to load files:", err);
      setView("dashboard");
    });

    const handleBeforeUnload = () => {
      if (activeIdRef.current) {
        sessionStorage.setItem(SESSION_KEY, activeIdRef.current);
      }
      engineRef.current?.flushBeacon();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      cancelled = true;
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [view, addActivity, loadFiles]);

  useEffect(() => {
    if (view === "landing") return;
    if (!settings.cloudSync) return;
    if (engineRef.current) return;

    let cancelled = false;
    (async () => {
      const { SyncEngine } = await import("./sync/engine");
      if (cancelled) return;
      const groupId = await deriveGroupId(settings.syncPassphrase);
      if (cancelled) return;
      const engine = new SyncEngine({ syncUrl: API_BASE, groupId: groupId || undefined });
      engineRef.current = engine;
      engine.setOnFilesUpdated((ids) => {
        const id = activeIdRef.current;
        if (id && ids.includes(id)) loadFileContent(id);
      });
      const ready = await engine.init();
      if (cancelled || !ready) {
        if (!cancelled) showToast("warning", "Sync server unavailable — files remain local");
        return;
      }
      showToast("success", "Connected to sync server");
      engine.syncAll().then(() => {
        if (!cancelled) engine.pull();
      });
    })();
    return () => { cancelled = true; };
  }, [view, settings.cloudSync, settings.syncPassphrase, loadFileContent]);

  useEffect(() => {
    if (!settings.cloudSync) {
      setPendingOpsCount(0);
      return;
    }
    const interval = setInterval(async () => {
      try {
        const ops = await getPendingOps();
        setPendingOpsCount(ops.length);
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [settings.cloudSync]);

  useEffect(() => {
    if (cryptoStatus === "error") {
      showToast("warning", "Web Crypto unavailable — files saved without encryption");
    }
  }, [cryptoStatus]);

  useEffect(() => {
    if (!fileData) return;
    updateFileInCache(fileData.id, { content: fileData.content, name: fileData.name });
  }, [fileData, updateFileInCache]);

  useEffect(() => {
    if (!isInitialLoad) return;
    const timer = setTimeout(async () => {
      const lastFileId = sessionStorage.getItem(SESSION_KEY);
      const shouldRestore = settings.restoreSession && lastFileId;

      if (shouldRestore) {
        const f = await getFile(lastFileId);
        if (f) {
          loadFile(lastFileId);
          setView("editor");
          addActivity("restore", `Restored "${f.name}" from previous session`);
          return;
        }
      }

      if (lastFileId) {
        const f = await getFile(lastFileId);
        if (f) {
          loadFile(lastFileId);
          setView("editor");
          addActivity("restore", `Restored "${f.name}" after restart`);
          return;
        }
        sessionStorage.removeItem(SESSION_KEY);
      }

      setView("dashboard");
    }, 1200);

    return () => clearTimeout(timer);
  }, [isInitialLoad, loadFile, settings.restoreSession, addActivity]);

  const createFile = useCallback(async () => {
    const created = await dbCreate("untitled.txt");
    if (settings.cloudSync) {
      const f = await getFile(created.id);
      if (f) await engineRef.current?.enqueue(f);
    }
    await Promise.all([loadFiles(), loadMeta()]);
    setScrollToId(created.id);
    await loadFileContent(created.id);
    loadFile(created.id);
    addActivity("created", `Created "${created.name}"`);
    setView("editor");
    setTimeout(() => setScrollToId(null), 100);
  }, [loadFiles, loadMeta, loadFileContent, loadFile, settings.cloudSync, addActivity]);

  const duplicateFile = useCallback(async (id: string) => {
    const f = await getFile(id);
    if (!f) return;
    const now = Date.now();
    const baseName = f.name.replace(/(\.[^.]+)$/, "");
    const ext = f.name.includes(".") ? f.name.slice(f.name.lastIndexOf(".")) : "";
    const copy = await dbCreate(`${baseName} copy${ext}`);
    await updateFile(copy.id, { content: f.content, updatedAt: now });
    if (settings.cloudSync) {
      const fresh = await getFile(copy.id);
      if (fresh) await engineRef.current?.enqueue(fresh);
    }
    await Promise.all([loadFiles(), loadMeta()]);
    setScrollToId(copy.id);
    await loadFileContent(copy.id);
    loadFile(copy.id);
    addActivity("created", `Duplicated "${copy.name}"`);
    setView("editor");
    setTimeout(() => setScrollToId(null), 100);
    showToast("success", `Duplicated as "${copy.name}"`);
  }, [loadFiles, loadMeta, loadFileContent, loadFile, settings.cloudSync, addActivity]);

  const deleteFile = useCallback(async (id: string) => {
    const f = files.find(x => x.id === id);
    const name = f?.name || "this file";
    setConfirmState({ fileId: id, fileName: name });
  }, [files]);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmState) return;
    const { fileId, fileName } = confirmState;
    setConfirmState(null);
    await dbDelete(fileId);
    if (settings.cloudSync) engineRef.current?.deleteFile(fileId);
    if (activeId === fileId) unloadFile();
    await Promise.all([loadFiles(), loadMeta()]);
    const cnt = await countFiles();
    showToast("info", `Deleted "${fileName}"`);
    if (cnt === 0) navigateToDashboard();
  }, [confirmState, activeId, loadFiles, loadMeta, unloadFile, settings.cloudSync, navigateToDashboard]);

  const handleContentChange = useCallback((content: string) => {
    if (!activeId) return;
    if (fileData) setFileData({ ...fileData, content, updatedAt: Date.now() });
    setSaved(false);
    setUnsavedIds((prev) => { const n = new Set(prev); n.add(activeId); return n; });
    scheduleSave(content);
  }, [activeId, fileData, setFileData, setSaved, scheduleSave]);

  const handleEditorBlur = useCallback(() => {
    if (!activeIdRef.current) return;
    flushSave().then(() => {
      if (settings.cloudSync) doSync(activeIdRef.current!);
    });
  }, [flushSave, doSync, settings.cloudSync]);

  const renameFile = useCallback(async (id: string, name: string) => {
    if (name.length > 128) { showToast("error", "Name too long (max 128 chars)"); return; }
    if (!name.trim()) { showToast("error", "Name cannot be empty"); return; }
    await updateFile(id, { name, updatedAt: Date.now() });
    if (id === activeId && fileData) setFileData({ ...fileData, name });
    await Promise.all([loadFiles(), loadMeta()]);
    doSync(id);
    addActivity("renamed", `Renamed to "${name}"`);
  }, [activeId, fileData, loadFiles, loadMeta, setFileData, doSync, addActivity]);

const handleSelectFile = useCallback(async (id: string) => {
    const file = await loadFileContent(id);
    if (file) {
      const { syncedAt, ...data } = file;
      setFileData(data);
      setActiveId(id);
    }
    search.close();
    setView("editor");
  }, [loadFileContent, setFileData, setActiveId, search]);

  const handleImportFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("error", "File too large (max 5 MB)");
      e.target.value = "";
      return;
    }
    const content = await file.text();
    const now = Date.now();
    const name = file.name;
    const created = await dbCreate(name);
    await updateFile(created.id, { content, updatedAt: now });
    if (settings.cloudSync) {
      const fresh = await getFile(created.id);
      if (fresh) await engineRef.current?.enqueue(fresh);
    }
    await Promise.all([loadFiles(), loadMeta()]);
    await loadFileContent(created.id);
    loadFile(created.id);
    addActivity("imported", `Imported "${name}"`);
    setView("editor");
    showToast("success", `Imported "${name}"`);
    e.target.value = "";
  }, [loadFiles, loadMeta, loadFileContent, loadFile, settings.cloudSync, addActivity]);

  const handleExportBackup = useCallback(async () => {
    const all = await getAllFiles();
    if (all.length === 0) {
      showToast("info", "No files to back up");
      return;
    }
    const payload = {
      app: "textpad",
      version: 1,
      exportedAt: Date.now(),
      files: all.map(({ id, name, content, createdAt, updatedAt }) => ({ id, name, content, createdAt, updatedAt })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `textpad-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addActivity("backup", `Exported ${all.length} file${all.length !== 1 ? "s" : ""} to local backup`);
    showToast("success", `Backup exported (${all.length} file${all.length !== 1 ? "s" : ""})`);
  }, [addActivity]);

  const handleRestoreBackup = useCallback(() => {
    backupInputRef.current?.click();
  }, []);

  const handleBackupInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const list = Array.isArray(data.files) ? data.files : data;
      if (!Array.isArray(list)) throw new Error("invalid backup");
      const limited = list.slice(0, 1000);

      const validFiles = limited.filter(
        (f: { id: string; name: string; content: string; createdAt?: number; updatedAt?: number }) =>
          f && typeof f.id === "string" && typeof f.name === "string" && typeof f.content === "string" &&
          f.name.length <= 128 && f.content.length <= 1_000_000
      );
      const skipped = limited.length - validFiles.length;

      const existing = await Promise.all(validFiles.map((f) => getFile(f.id)));
      const toRestore = validFiles.filter((f, i) => !existing[i]);

      await Promise.all(
        toRestore.map((f) =>
          addFile({
            id: f.id,
            name: f.name,
            content: f.content,
            createdAt: f.createdAt || Date.now(),
            updatedAt: f.updatedAt || Date.now(),
            syncedAt: 0,
            version: 0,
          })
        )
      );

      const restored = toRestore.length;
      await Promise.all([loadFiles(), loadMeta()]);
      addActivity("backup", `Restored ${restored} file${restored !== 1 ? "s" : ""} from local backup`);
      showToast("success", skipped > 0 ? `Restored ${restored} file${restored !== 1 ? "s" : ""} (${skipped} skipped)` : `Restored ${restored} file${restored !== 1 ? "s" : ""}`);
    } catch {
      showToast("error", "Invalid backup file");
    }
    e.target.value = "";
  }, [addActivity, loadFiles, loadMeta]);

  const handleOnboardingComplete = useCallback((data: OnboardingData) => {
    localStorage.setItem("textpad-onboarding-completed", "true");
    if (data.theme !== "system") updateSetting("theme", data.theme);
    updateSetting("fontFamily", data.font);
    updateSetting("autoSave", data.autosave);
    if (data.storage === "cloud") updateSetting("cloudSync", true);
    setShowOnboarding(false);
    addActivity("created", "Completed initial setup");
    showToast("success", "Welcome to TextPad!");
  }, [updateSetting, addActivity]);

  const handleOnboardingDismiss = useCallback(() => {
    localStorage.setItem("textpad-onboarding-completed", "true");
    setShowOnboarding(false);
  }, []);

  return (
    <div className="app-root">
      {view === "landing" ? (
        <LandingPage onGetStarted={onGetStarted} />
      ) : view === "loading" ? (
        <LoadingScreen />
      ) : view === "notfound" ? (
        <NotFound onGoHome={() => setView("dashboard")} />
      ) : (
        <>
          {isMobile && sidebarOpen && (
            <div className="app-backdrop" onClick={() => setSidebarOpen(false)} aria-hidden="true" />
          )}
          <Toolbar
            sidebarOpen={sidebarOpen}
            isMobile={isMobile}
            onToggleSidebar={() => setSidebarOpen((o) => !o)}
            onCreateFile={createFile}
            onOpenSearch={search.toggleOpen}
            onOpenSettings={() => setSettingsOpen(true)}
            syncStatus={syncStatus}
            onDashboard={view === "editor" ? navigateToDashboard : undefined}
          />
          <div className="app-body">
            <Sidebar
              open={sidebarOpen}
              isMobile={isMobile}
              files={meta}
              activeId={activeId}
              scrollToId={scrollToId}
              unsavedIds={unsavedIds}
              onSelect={handleSelectFile}
              onCreate={createFile}
              onDelete={deleteFile}
              onDuplicate={duplicateFile}
              onRename={renameFile}
              onToggle={() => setSidebarOpen((o) => !o)}
              onDashboard={navigateToDashboard}
              showDashboardLink={view !== "dashboard"}
            />
            <div className="editor-pane">
              {view === "dashboard" && (
                <Dashboard
                  files={meta}
                  cryptoStatus={cryptoStatus}
                  syncEngineStatus={syncStatus}
                  syncPendingCount={pendingOpsCount}
                  connected={connected}
                  settings={settings}
                  activities={activities}
                  storageEstimate={storageEstimate}
                  onCreateFile={createFile}
                  onOpenFile={handleSelectFile}
                  onOpenSettings={() => setSettingsOpen(true)}
                  onOpenSearch={search.toggleOpen}
                  onImportFile={handleImportFile}
                  onExportBackup={handleExportBackup}
                  onRestoreBackup={handleRestoreBackup}
                />
              )}
              {view === "editor" && (
                <>
                  <Suspense fallback={<div className="editor-placeholder">Loading editor...</div>}>
                    {fileData ? (
                      <Editor
                        key={activeId}
                        file={fileData}
                        onChange={handleContentChange}
                        onBlur={handleEditorBlur}
                        onCreateFile={createFile}
                      />
                    ) : (
                      <NoFileSelected onCreateFile={createFile} />
                    )}
                  </Suspense>
                  <StatusBar
                    file={fileData}
                    saved={saved}
                    syncStatus={syncStatus}
                    connected={connected}
                    cryptoReady={cryptoStatus === "ready"}
                    pendingOps={pendingOpsCount}
                    storageUsage={storageEstimate ? `${(storageEstimate.usage / 1024 / 1024).toFixed(1)}MB` : "—"}
                  />
                </>
              )}
            </div>
          </div>

          <SearchPanel
            open={search.open}
            query={search.query}
            mode={search.mode}
            fileResults={search.fileResults}
            contentResults={search.contentResults}
            onQueryChange={search.setQuery}
            onModeChange={search.setMode}
            onClose={search.close}
            onSelectFile={handleSelectFile}
          />

          <SettingsDialog
            open={settingsOpen}
            settings={settings}
            onUpdate={updateSetting}
            onReset={resetSettings}
            onClose={() => setSettingsOpen(false)}
          />

          {showOnboarding && (
            <OnboardingWizard
              onComplete={handleOnboardingComplete}
              onDismiss={handleOnboardingDismiss}
            />
          )}

          <ConfirmDialog
            open={confirmState !== null}
            title="Delete file?"
            message={`Delete "${confirmState?.fileName || ""}"? This cannot be undone.`}
            onConfirm={handleConfirmDelete}
            onCancel={() => setConfirmState(null)}
          />

          <ToastInner />

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json,.js,.ts,.css,.html,.csv,.xml,.yaml,.yml"
            style={{ display: "none" }}
            onChange={handleFileInput}
          />
          <input
            ref={backupInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={handleBackupInput}
          />
        </>
      )}
    </div>
  );
}

export default AppInner;
