"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

type Repertoire = {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
  dueCount: number;
};

export default function RepertoireList({ repertoires: initial }: { repertoires: Repertoire[] }) {
  const router = useRouter();
  const [repertoires, setRepertoires] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<"white" | "black">("white");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalDue = repertoires.reduce((s, r) => s + r.dueCount, 0);

  async function handleCreate(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch("/api/repertoires", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, color }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create.");
      return;
    }

    const created = await res.json();
    setRepertoires((prev) => [{ ...created, dueCount: 0 }, ...prev]);
    setName("");
    setColor("white");
    setShowForm(false);
  }

  async function handleDelete(r: Repertoire) {
    if (!confirm(`Delete "${r.name}" and all its variations? This cannot be undone.`)) return;
    setRepertoires((prev) => prev.filter((x) => x.id !== r.id));
    fetch("/api/repertoires", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id }),
    }).catch(console.error);
  }

  const deck =
    repertoires.length === 0
      ? "Build your first opening repertoire to begin."
      : `${repertoires.length} ${repertoires.length === 1 ? "repertoire" : "repertoires"}` +
        (totalDue ? ` · ${totalDue} ${totalDue === 1 ? "move" : "moves"} due today` : " · all caught up");

  return (
    <div style={{ minHeight: "100vh", padding: "0 24px 80px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 28 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "-0.01em" }}>
            MoveForge
          </div>
          <ThemeToggle />
        </div>

        {/* Masthead */}
        <header style={{ paddingTop: 64, paddingBottom: 28 }}>
          <div style={{ color: "var(--accent)", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Your opening study
          </div>
          <h1 style={{ fontSize: "clamp(42px, 7vw, 66px)", margin: 0, color: "var(--text)" }}>
            Repertoires
          </h1>
          <p style={{ marginTop: 16, color: "var(--text-3)", fontSize: 16, maxWidth: 460 }}>
            {deck}
          </p>
        </header>

        {/* New repertoire */}
        {!showForm && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <button
              onClick={() => { setShowForm(true); setError(null); }}
              style={{
                background: "transparent", border: "1px solid var(--accent-border)", borderRadius: 999,
                color: "var(--accent)", fontSize: 14, fontWeight: 500, padding: "9px 20px",
                cursor: "pointer", fontFamily: "inherit",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-soft)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
            >
              + New repertoire
            </button>
          </div>
        )}

        {/* Create form */}
        {showForm && (
          <form
            onSubmit={handleCreate}
            style={{
              background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12,
              padding: 28, marginBottom: 28, display: "flex", flexDirection: "column", gap: 20,
            }}
          >
            <h2 style={{ fontSize: 26, margin: 0, color: "var(--text)" }}>New repertoire</h2>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 14, color: "var(--text-2)" }}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
                placeholder="e.g. Sicilian as White"
                style={{
                  background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
                  padding: "11px 14px", color: "var(--text)", fontSize: 15, fontFamily: "inherit", outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 14, color: "var(--text-2)" }}>I play as</label>
              <div style={{ display: "flex", gap: 12 }}>
                {(["white", "black"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      flex: 1, padding: "12px 0", borderRadius: 8,
                      border: `1px solid ${color === c ? "var(--accent)" : "var(--border)"}`,
                      background: color === c ? "var(--accent-soft)" : "transparent",
                      color: color === c ? "var(--accent)" : "var(--text-3)",
                      fontSize: 15, cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {c === "white" ? "♔ White" : "♚ Black"}
                  </button>
                ))}
              </div>
            </div>

            {error && <p style={{ color: "var(--danger)", fontSize: 14, margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 12 }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  flex: 1, padding: "12px 0", background: "var(--accent)", border: "none", borderRadius: 8,
                  color: "var(--accent-text)", fontSize: 15, fontWeight: 600, cursor: "pointer",
                  fontFamily: "inherit", opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? "Creating…" : "Create repertoire"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setError(null); }}
                style={{
                  padding: "12px 22px", background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 8, color: "var(--text-3)", fontSize: 15, cursor: "pointer", fontFamily: "inherit",
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Empty state */}
        {repertoires.length === 0 && !showForm && (
          <div style={{ textAlign: "center", padding: "72px 0", color: "var(--text-4)", fontSize: 16 }}>
            Nothing here yet.
          </div>
        )}

        {/* Repertoire index — table-of-contents style */}
        {repertoires.length > 0 && (
          <div style={{ borderTop: "1px solid var(--border)" }}>
            {repertoires.map((r, i) => (
              <div
                key={r.id}
                onClick={() => router.push(`/repertoire/${r.id}`)}
                style={{
                  display: "flex", alignItems: "center", gap: 18,
                  padding: "22px 6px", borderBottom: "1px solid var(--border)", cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--text-4)", width: 26, flexShrink: 0 }}>
                  {String(i + 1).padStart(2, "0")}
                </div>

                <div style={{
                  fontSize: 19, lineHeight: 1, width: 40, height: 40, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8,
                  // piece colors, not theme colors — identical in both themes
                  background: r.color === "white" ? "#ede6d7" : "#191919",
                  border: `1px solid ${r.color === "white" ? "#c8b898" : "#3c3c3c"}`,
                  color: r.color === "white" ? "#191919" : "#ede6d7",
                }}>
                  {r.color === "white" ? "♔" : "♚"}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: "var(--font-display)", fontSize: 21, color: "var(--text)", marginBottom: 3,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-4)" }}>
                    {r.color === "white" ? "White" : "Black"} · added {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>

                {r.dueCount > 0 ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/repertoire/${r.id}/review`); }}
                    style={{
                      flexShrink: 0, padding: "8px 16px", background: "var(--accent)", border: "none",
                      borderRadius: 999, color: "var(--accent-text)", fontSize: 14, fontWeight: 600,
                      cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {r.dueCount} due →
                  </button>
                ) : (
                  <span style={{ flexShrink: 0, fontSize: 13, color: "var(--text-4)" }}>
                    Up to date
                  </span>
                )}

                <button
                  title="Delete repertoire"
                  onClick={(e) => { e.stopPropagation(); handleDelete(r); }}
                  style={{
                    flexShrink: 0, background: "none", border: "none", cursor: "pointer",
                    color: "var(--text-4)", fontSize: 20, lineHeight: 1, padding: "4px 6px", fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-4)"; }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
