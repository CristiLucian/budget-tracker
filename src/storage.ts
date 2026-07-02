import type { AppState } from "./types";

const KEY = "buget:v1";
const DEBOUNCE_MS = 300;

let pending: AppState | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function writeNow(state: AppState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (err) {
    console.error("Nu s-a putut salva starea", err);
  }
}

export function loadState(): AppState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    if (!parsed || !parsed.settings || !Array.isArray(parsed.periods)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: AppState): void {
  pending = state;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    if (pending) {
      writeNow(pending);
      pending = null;
    }
  }, DEBOUNCE_MS);
}

export function flush(): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending) {
    writeNow(pending);
    pending = null;
  }
}

export function clearState(): void {
  if (timer) clearTimeout(timer);
  timer = null;
  pending = null;
  localStorage.removeItem(KEY);
}

// Don't lose the debounced write when the tab closes or goes to background.
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
