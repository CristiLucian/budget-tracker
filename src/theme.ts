export type ThemePref = "light" | "dark" | "system";

const KEY = "buget:theme";

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "system";
}

function resolve(pref: ThemePref): "light" | "dark" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return pref;
}

export function applyTheme(pref: ThemePref): void {
  const mode = resolve(pref);
  document.documentElement.dataset.theme = mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", mode === "dark" ? "#0b1220" : "#0e9384");
}

export function setThemePref(pref: ThemePref): void {
  if (pref === "system") localStorage.removeItem(KEY);
  else localStorage.setItem(KEY, pref);
  applyTheme(pref);
}

/** Call once at startup (before render) to avoid a flash of the wrong theme. */
export function initTheme(): void {
  applyTheme(getThemePref());
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (getThemePref() === "system") applyTheme("system");
    });
}
