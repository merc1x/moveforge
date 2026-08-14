"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  // null until mounted — the real theme is only known on the client
  const [theme, setTheme] = useState<"dark" | "light" | null>(null);

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch {}
    setTheme(next);
  }

  return (
    <button
      onClick={toggle}
      title="Toggle light/dark theme"
      style={{
        background: "transparent", border: "1px solid var(--border)", borderRadius: 3,
        color: "var(--text-3)", fontSize: 12, lineHeight: 1, padding: "7px 10px",
        cursor: "pointer", fontFamily: "inherit",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-border)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
    >
      {theme === null ? "◐" : theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
