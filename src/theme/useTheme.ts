import { useCallback, useEffect, useState } from "react";

export type ThemePref = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "iceberg-theme";
const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemTheme(): ResolvedTheme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function readStoredPref(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" ? v : "system";
}

/**
 * Theme state: follows the OS by default, but a toggle pins an explicit choice
 * that persists to localStorage and wins over the OS. The resolved theme is
 * mirrored onto <html data-theme> so the token stylesheet can react.
 */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readStoredPref);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = () => setSystem(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved: ResolvedTheme = pref === "system" ? system : pref;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved);
  }, [resolved]);

  useEffect(() => {
    if (pref === "system") localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, pref);
  }, [pref]);

  const toggle = useCallback(() => {
    setPref(() => (resolved === "dark" ? "light" : "dark"));
  }, [resolved]);

  return { resolved, pref, toggle };
}
