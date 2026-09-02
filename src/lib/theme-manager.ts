import { useState, useEffect } from "react";

export type ThemeMode = "dark" | "light";

const THEME_STORAGE_KEY = "formbhro-theme-preference";

export function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const body = document.body;
  if (theme === "light") {
    root.classList.add("light-theme");
    root.classList.remove("dark-theme");
    if (body) {
      body.classList.add("light-theme");
      body.classList.remove("dark-theme");
    }
  } else {
    root.classList.add("dark-theme");
    root.classList.remove("light-theme");
    if (body) {
      body.classList.add("dark-theme");
      body.classList.remove("light-theme");
    }
  }
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = (newTheme?: ThemeMode) => {
    const target = newTheme || (theme === "dark" ? "light" : "dark");
    setTheme(target);
    applyTheme(target);
  };

  return { theme, setTheme: toggleTheme, isDark: theme === "dark" };
}
