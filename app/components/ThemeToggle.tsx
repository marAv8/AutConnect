"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { traceDashboardInteractionHandled, traceDashboardInteractionState } from "@/app/dashboard/dashboardInteractionTraceClient";

const THEME_STORAGE_KEY = "autconnect-theme";
const THEME_CHANGE_EVENT = "autconnect-theme-change";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  const isDark = theme === "dark";
  document.documentElement.classList.toggle("dark", isDark);
  document.documentElement.style.colorScheme = theme;
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: theme }));
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const readTheme = () =>
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");

    const onThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<Theme>).detail;
      if (nextTheme === "light" || nextTheme === "dark") {
        setTheme(nextTheme);
        return;
      }
      readTheme();
    };

    readTheme();
    window.addEventListener(THEME_CHANGE_EVENT, onThemeChange);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, onThemeChange);
  }, []);

  useEffect(() => {
    traceDashboardInteractionState(theme === "dark" ? "theme-dark" : "theme-light");
  }, [theme]);

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className="material-control dashboard-round-icon-control dashboard-round-icon-control--arrival dashboard-theme-control"
      data-dashboard-trace-control="theme"
      aria-label={label}
      title={label}
      aria-pressed={isDark}
      onClick={() => {
        traceDashboardInteractionHandled("theme");
        const nextTheme: Theme = isDark ? "light" : "dark";
        applyTheme(nextTheme);
        setTheme(nextTheme);
      }}
    >
      <span className="dashboard-utility-arrival-visual">
        {isDark ? (
          <Sun aria-hidden="true" size={23} strokeWidth={1.75} />
        ) : (
          <Moon aria-hidden="true" size={22} strokeWidth={1.8} />
        )}
      </span>
    </button>
  );
}
