"use client";

import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

type Section = {
  key: string;
  icon: string;
  title: string;
  subtitle: string;
  // Absent while a section is still being built — the card renders dimmed,
  // badged "Soon" and is not clickable.
  href?: string;
};

const SECTIONS: Section[] = [
  {
    key: "repertoires",
    icon: "♞",
    title: "MoveForge",
    subtitle: "Build and train your opening repertoires",
    href: "/repertoires",
  },
  {
    key: "puzzles",
    icon: "✦",
    title: "Puzzles",
    subtitle: "Coming soon",
  },
];

export default function Hub({ userInitial }: { userInitial: string }) {
  return (
    <div style={{ minHeight: "100vh", padding: "0 24px 80px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 28 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>
            MoveForge
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <ThemeToggle />
            <Link
              href="/profile"
              title="Profile"
              style={{
                width: 38, height: 38, borderRadius: "50%", display: "flex", alignItems: "center",
                justifyContent: "center", background: "var(--accent)", color: "var(--accent-text)",
                fontFamily: "var(--font-display)", fontSize: 17, fontWeight: 600, textDecoration: "none",
                flexShrink: 0,
              }}
            >
              {userInitial}
            </Link>
          </div>
        </div>

        {/* Masthead */}
        <header style={{ paddingTop: 64, paddingBottom: 36 }}>
          <div style={{ color: "var(--accent)", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Your chess workshop
          </div>
          <h1 style={{ fontSize: "clamp(42px, 7vw, 66px)", margin: 0, color: "var(--text)" }}>
            Choose a bench
          </h1>
        </header>

        {/* Section cards — auto-fit collapses 3 → 2 → 1 as the viewport narrows */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
          gap: 16,
          alignItems: "stretch",
        }}>
          {SECTIONS.map((s) => <SectionCard key={s.key} section={s} />)}
        </div>

      </div>
    </div>
  );
}

function SectionCard({ section }: { section: Section }) {
  const available = !!section.href;

  const body = (
    <>
      {!available && (
        <span style={{
          position: "absolute", top: 14, right: 14,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
          color: "var(--text-4)", border: "1px solid var(--border)", borderRadius: 999,
          padding: "3px 9px",
        }}>
          Soon
        </span>
      )}
      <div style={{
        fontSize: 34, lineHeight: 1, marginBottom: 20,
        color: available ? "var(--accent)" : "var(--text-4)",
      }}>
        {section.icon}
      </div>
      <div style={{
        fontFamily: "var(--font-display)", fontSize: 22, color: "var(--text)", marginBottom: 8,
      }}>
        {section.title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5, color: "var(--text-3)" }}>
        {section.subtitle}
      </div>
    </>
  );

  const base = {
    position: "relative" as const,
    display: "block",
    background: "var(--panel)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "26px 24px 28px",
    textDecoration: "none",
    minHeight: 168,
    boxSizing: "border-box" as const,
    transition: "transform 140ms ease, border-color 140ms ease, background 140ms ease",
  };

  if (!available) {
    return <div style={{ ...base, opacity: 0.55, cursor: "default" }} aria-disabled>{body}</div>;
  }

  return (
    <Link
      href={section.href!}
      style={base}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--accent-border)";
        e.currentTarget.style.background = "var(--accent-faint)";
        e.currentTarget.style.transform = "translateY(-2px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.background = "var(--panel)";
        e.currentTarget.style.transform = "none";
      }}
    >
      {body}
    </Link>
  );
}
