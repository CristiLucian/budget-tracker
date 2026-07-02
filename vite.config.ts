import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages serves the app under /<repo-name>/ — the deploy workflow
// sets BASE_PATH=/budget-tracker/. Locally it stays "/".
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icons/icon-192.png", "icons/icon-512.png"],
      manifest: {
        name: "Buget",
        short_name: "Buget",
        description: "Urmărire buget personal",
        lang: "ro",
        start_url: ".",
        scope: ".",
        display: "standalone",
        background_color: "#f6f7f9",
        theme_color: "#0e9384",
        icons: [
          { src: "icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icons/icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico,woff2}"],
        // exceljs chunk is ~1MB; raise the precache limit so Excel export
        // works offline too
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1500
  }
});
