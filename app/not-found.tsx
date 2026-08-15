import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 600, marginBottom: 8 }}>MoveForge</div>
        <h1 style={{ fontSize: 38, margin: "0 0 14px" }}>Page not found</h1>
        <p style={{ margin: "0 0 28px", color: "var(--text-3)", fontSize: 16 }}>
          That page doesn&apos;t exist — it may have moved, or you may be signed out.
        </p>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link
            href="/"
            style={{
              padding: "12px 22px", background: "var(--accent)", borderRadius: 8,
              color: "var(--accent-text)", fontSize: 15, fontWeight: 600, textDecoration: "none",
            }}
          >
            Your repertoires
          </Link>
          <Link href="/login" style={{ color: "var(--accent)", fontSize: 14, textDecoration: "none" }}>Sign in</Link>
        </div>
      </div>
    </div>
  );
}
