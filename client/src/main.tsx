import { StrictMode, Profiler } from "react";
import type { ProfilerOnRenderCallback } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { encryptContent, decryptContent } from "./db";
import "./index.css";

if (!globalThis.crypto?.subtle) {
  console.warn(
    "[TextPad] Web Crypto API unavailable — encryption disabled. " +
    "Files will still save locally, but without at-rest encryption."
  );
}

const perfEnabled = new URLSearchParams(window.location.search).has("perf");

interface PerfStats {
  commits: number;
  totalMs: number;
  byId: Record<string, { count: number; ms: number }>;
}

let perfStats: PerfStats = { commits: 0, totalMs: 0, byId: {} };

if (perfEnabled) {
  const win = window as unknown as Record<string, unknown>;
  win.__textpadPerf = {
    reset() {
      perfStats = { commits: 0, totalMs: 0, byId: {} };
    },
    get stats() {
      return perfStats;
    },
  };
  win.__textpadCrypto = { encryptContent, decryptContent };
}

const onRender: ProfilerOnRenderCallback = (id, _phase, actualDuration) => {
  perfStats.commits++;
  perfStats.totalMs += actualDuration;
  const entry = (perfStats.byId[id] ??= { count: 0, ms: 0 });
  entry.count++;
  entry.ms += actualDuration;
};

const app = (
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {perfEnabled ? <Profiler id="app" onRender={onRender}>{app}</Profiler> : app}
  </StrictMode>
);
