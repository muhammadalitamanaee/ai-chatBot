"use client";

import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("themechange", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("themechange", callback); };
}
function snapshot() { return document.documentElement.classList.contains("dark"); }
function serverSnapshot() { return false; }

export function DarkModeToggle() {
  const isDark = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("darkMode", String(next));
    window.dispatchEvent(new Event("themechange"));
  };
  return <button type="button" onClick={toggle} className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-soft hover:text-foreground" title={isDark ? "حالت روشن" : "حالت تاریک"} aria-label={isDark ? "فعال‌کردن حالت روشن" : "فعال‌کردن حالت تاریک"}>{isDark ? "☀" : "☾"}</button>;
}
