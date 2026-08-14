"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  const inputStyle = {
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "11px 14px", color: "var(--text)", fontSize: 15, fontFamily: "inherit", outline: "none",
  } as const;

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>MoveForge</div>
        <h1 style={{ fontSize: 38, margin: "0 0 28px" }}>Sign in</h1>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label style={{ fontSize: 14, color: "var(--text-2)" }}>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus style={inputStyle} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            <label style={{ fontSize: 14, color: "var(--text-2)" }}>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={inputStyle} />
          </div>

          {error && <p style={{ color: "var(--danger)", fontSize: 14, margin: 0 }}>{error}</p>}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4, padding: "12px 0", background: "var(--accent)", border: "none", borderRadius: 8,
              color: "var(--accent-text)", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p style={{ marginTop: 24, fontSize: 14, color: "var(--text-3)" }}>
          No account yet?{" "}
          <Link href="/register" style={{ color: "var(--accent)", textDecoration: "none" }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
