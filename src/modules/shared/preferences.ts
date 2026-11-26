const LARGE_TEXT_KEY = "arriendaya_large_text";
const THEME_KEY = "arriendaya_theme";
const CONTRAST_KEY = "arriendaya_contrast";
const PREFERENCES_EVENT = "arriendaya:preferences-changed";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";
export type ContrastPreference = "normal" | "high";

export function getLargeTextPreference(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LARGE_TEXT_KEY) === "1";
}

export function getThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const raw = localStorage.getItem(THEME_KEY);
  if (raw === "light" || raw === "dark" || raw === "system") return raw;
  return "system";
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "dark") return "dark";
  if (pref === "light") return "light";
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function getContrastPreference(): ContrastPreference {
  if (typeof window === "undefined") return "normal";
  return localStorage.getItem(CONTRAST_KEY) === "high" ? "high" : "normal";
}

export function applyThemeToDocument(pref: ThemePreference): ResolvedTheme {
  const resolved = resolveTheme(pref);
  if (typeof document !== "undefined") {
    const root = document.documentElement;
    root.setAttribute("data-theme", resolved);
    root.setAttribute("data-theme-preference", pref);
    root.style.colorScheme = resolved;
  }
  return resolved;
}

export function applyContrastToDocument(pref: ContrastPreference): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-contrast", pref);
  }
}

export function applyLargeTextToDocument(enabled: boolean): void {
  if (typeof document !== "undefined") {
    document.documentElement.style.fontSize = enabled ? "18px" : "16px";
  }
}

function notifyPreferencesChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PREFERENCES_EVENT));
  }
}

export function setLargeTextPreference(enabled: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LARGE_TEXT_KEY, enabled ? "1" : "0");
  applyLargeTextToDocument(enabled);
  notifyPreferencesChanged();
}

export function setThemePreference(pref: ThemePreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, pref);
  applyThemeToDocument(pref);
  notifyPreferencesChanged();
}

export function setContrastPreference(pref: ContrastPreference): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CONTRAST_KEY, pref);
  applyContrastToDocument(pref);
  notifyPreferencesChanged();
}

export function syncAllAccessibilityPreferences(): void {
  if (typeof window === "undefined") return;
  applyLargeTextToDocument(getLargeTextPreference());
  applyThemeToDocument(getThemePreference());
  applyContrastToDocument(getContrastPreference());
}

export function subscribeAccessibilityPreferences(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const media =
    typeof window.matchMedia === "function"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  const handleSystemChange = () => {
    if (getThemePreference() === "system") {
      applyThemeToDocument("system");
      onChange();
    }
  };

  const handleStorage = (e: StorageEvent) => {
    if (e.key === THEME_KEY || e.key === CONTRAST_KEY || e.key === LARGE_TEXT_KEY || e.key === null) {
      syncAllAccessibilityPreferences();
      onChange();
    }
  };

  const handleCustomEvent = () => {
    onChange();
  };

  media?.addEventListener("change", handleSystemChange);
  window.addEventListener("storage", handleStorage);
  window.addEventListener(PREFERENCES_EVENT, handleCustomEvent);

  return () => {
    media?.removeEventListener("change", handleSystemChange);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(PREFERENCES_EVENT, handleCustomEvent);
  };
}
