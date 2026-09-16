"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.getAttribute("data-theme") === "dark");
  }, []);

  function toggle() {
    const next = dark ? "light" : "dark";
    setDark(!dark);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("lab-theme", next);
    } catch {
      // ignore private-mode storage failures
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "الوضع الفاتح" : "الوضع الليلي"}
      className="flex items-center rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
