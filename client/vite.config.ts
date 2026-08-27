import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectManifest: {
        rollupFormat: "iife",
        globPatterns: ["**/*.{js,css,html,ttf,woff2,png,svg,ico}"],
      },
    }),
  ],
  server: {
    proxy: { "/api": "http://localhost:3001" },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ["./src/components/Editor.tsx"],
        },
      },
    },
  },
});
