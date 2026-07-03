import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { initTheme } from "./theme";
// Inter with latin-ext (Romanian diacritics), self-hosted for offline use
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-ext-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-ext-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-ext-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/inter/latin-ext-700.css";
import "./index.css";

// Register the service worker only when it looks safe to do so.
try {
  if (typeof window !== "undefined" && "isSecureContext" in window && window.isSecureContext && "serviceWorker" in navigator) {
    registerSW({ immediate: true });
  }
} catch (err) {
  // Swallow registration errors (e.g. in restricted webviews) to avoid breaking the app.
  // eslint-disable-next-line no-console
  console.warn("Service worker registration skipped:", err);
}

// Ask the browser to treat our storage as persistent (protects
// localStorage/IndexedDB from eviction under storage pressure).
if (navigator.storage?.persist) {
  navigator.storage.persist().catch(() => {});
}

// Apply the saved (or system) theme before first paint to avoid a flash.
initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
