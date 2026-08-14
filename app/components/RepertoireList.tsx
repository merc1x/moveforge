"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Repertoire = {
  id: string;
  name: string;
  color: string;
  createdAt: Date;
};

export default function RepertoireList({ repertoires: initial }: { repertoires: Repertoire[] }) {
  const router = useRouter();
  const [repertoires, setRepertoires] = useState(initial);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<"white" | "black">("white");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    setRepertoires((prev) => [created, ...prev]);
    setName("");
    setColor("white");
    setShowForm(false);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f0f", color: "#e8e0d0", fontFamily: "'IBM Plex Mono', monospace", padding: 40 }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
          <div>
            <div style={{ fontSize: 10, letterSpacing: "0.2em", textTransform: "uppercase", color: "#555", marginBottom: 6 }}>
              MoveForge
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: "#e8e0d0" }}>My Repertoires</h1>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setError(null); }}
            style={{ padding: "10px 20px", background: "#c8a96e", border: "none", borderRadius: 4, color: "#0f0f0f", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}
          >
            + New Repertoire
          </button>
        </div>

        {/* Neues Repertoire Formular */}
        {showForm && (
          <form onSubmit={handleCreate} style={{ background: "#161616", border: "1px solid #2a2a2a", borderRadius: 6, padding: 24, marginBottom: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#555" }}>
              New Repertoire
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ fontSize: 11, color: "#666", letterSpacing: "0.08em" }}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Sicilian as White"
                style={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 3, padding: "8px 12px", color: "#e8e0d0", fontSize: 12, fontFamily: "inherit", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <label style={{ fontSize: 11, color: "#666", letterSpacing: "0.08em" }}>I play as</label>
              <div style={{ display: "flex", gap: 10 }}>
                {(["white", "black"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    style={{
                      flex: 1, padding: "10px 0", borderRadius: 3, border: `1px solid ${color === c ? "#c8a96e" : "#2a2a2a"}`,
                      background: color === c ? "#c8a96e22" : "transparent",
                      color: color === c ? "#c8a96e" : "#555",
                      fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit",
                    }}
                  >
                    {c === "white" ? "♔ White" : "♚ Black"}
                  </button>
                ))}
              </div>
            </div>

            {error && <p style={{ color: "#e05252", fontSize: 12, margin: 0 }}>{error}</p>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="submit"
                disabled={loading}
                style={{ flex: 1, padding: "10px 0", background: "#c8a96e", border: "none", borderRadius: 3, color: "#0f0f0f", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit", opacity: loading ? 0.6 : 1 }}
              >
                {loading ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                style={{ padding: "10px 20px", background: "transparent", border: "1px solid #2a2a2a", borderRadius: 3, color: "#555", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer", fontFamily: "inherit" }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        {/* Repertoire Liste */}
        {repertoires.length === 0 && !showForm && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#333", fontSize: 13 }}>
            No repertoires yet. Create your first one!
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {repertoires.map((r) => (
            <div
              key={r.id}
              onClick={() => router.push(`/repertoire/${r.id}`)}
              style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", background: "#161616", border: "1px solid #2a2a2a", borderRadius: 4, cursor: "pointer", transition: "border-color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3a3a3a")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
            >
              <div style={{
                fontSize: 20, lineHeight: 1,
                width: 36, height: 36, flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 4,
                background: r.color === "white" ? "#e8e0d0" : "#1a1a1a",
                border: `1px solid ${r.color === "white" ? "#c8b898" : "#3a3a3a"}`,
                color: r.color === "white" ? "#1a1a1a" : "#e8e0d0",
              }}>
                {r.color === "white" ? "♔" : "♚"}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#e8e0d0", marginBottom: 4 }}>{r.name}</div>
                <div style={{ fontSize: 10, color: "#444", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {r.color === "white" ? "White" : "Black"} · {new Date(r.createdAt).toLocaleDateString("en-US")}
                </div>
              </div>
              <div style={{ color: "#333", fontSize: 16 }}>›</div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
