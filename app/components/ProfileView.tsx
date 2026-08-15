"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

export type ProfileData = {
  name: string | null;
  email: string;
  memberSince: string;
  stats: {
    repertoires: number;
    variations: number;
    moves: number;
    dueNow: number;
    dueWeek: number;
    nextReviewAt: number | null;
    totalReviews: number;
  };
  activity: { date: string; count: number }[];
  perRepertoire: { id: string; name: string; color: string; lines: number; moves: number; dueNow: number }[];
};

const HEATMAP_WEEKS = 26;
const DAY_MS = 24 * 60 * 60 * 1000;

function utcKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

function heatColor(count: number) {
  if (count <= 0) return "var(--border-soft)";
  if (count <= 2) return "color-mix(in srgb, var(--accent) 28%, var(--bg))";
  if (count <= 5) return "color-mix(in srgb, var(--accent) 52%, var(--bg))";
  if (count <= 9) return "color-mix(in srgb, var(--accent) 78%, var(--bg))";
  return "var(--accent)";
}

export default function ProfileView({ data }: { data: ProfileData }) {
  const s = data.stats;

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [pwMsg, setPwMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function changePassword(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setPwMsg(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: cur, newPassword: next }),
    });
    setSaving(false);
    if (res.ok) {
      setPwMsg({ kind: "ok", text: "Password updated." });
      setCur(""); setNext("");
    } else {
      const d = await res.json().catch(() => ({}));
      setPwMsg({ kind: "err", text: d.error ?? "Could not update password." });
    }
  }

  // Clear the session, then navigate ourselves. Letting Auth.js do the redirect
  // means following the absolute URL it builds from the request host — behind a
  // proxy that host is not always the one the browser is on, and the navigation
  // lands on a 404. A relative path always resolves against the current origin.
  async function leave() {
    try {
      await signOut({ redirect: false });
    } finally {
      window.location.href = "/login";
    }
  }

  async function deleteAccount() {
    if (!confirm("Delete your account and ALL your repertoires? This cannot be undone.")) return;
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      setPwMsg({ kind: "err", text: "Could not delete your account. Please try again." });
      return;
    }
    await leave();
  }

  const nextReviewLabel = (() => {
    if (s.nextReviewAt === null) return "—";
    const days = Math.ceil((s.nextReviewAt - Date.now()) / DAY_MS);
    return days <= 1 ? "tomorrow" : `in ${days} days`;
  })();

  // ── Build the heatmap grid (26 weeks, weekday-aligned, UTC) ────────────────
  const countMap = new Map(data.activity.map((a) => [a.date, a.count]));
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const gridStart = new Date(today);
  gridStart.setUTCDate(today.getUTCDate() - today.getUTCDay() - (HEATMAP_WEEKS - 1) * 7);

  const weeks: { key: string; count: number; future: boolean; date: Date }[][] = [];
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const col: { key: string; count: number; future: boolean; date: Date }[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(gridStart);
      day.setUTCDate(gridStart.getUTCDate() + w * 7 + d);
      const key = utcKey(day);
      col.push({ key, count: countMap.get(key) ?? 0, future: day.getTime() > today.getTime(), date: day });
    }
    weeks.push(col);
  }

  // Current streak: consecutive days with activity ending today (or yesterday
  // if today hasn't been reviewed yet, so the streak isn't prematurely broken).
  let streak = 0;
  {
    const probe = new Date(today);
    if ((countMap.get(utcKey(probe)) ?? 0) === 0) probe.setUTCDate(probe.getUTCDate() - 1);
    while ((countMap.get(utcKey(probe)) ?? 0) > 0) {
      streak++;
      probe.setUTCDate(probe.getUTCDate() - 1);
    }
  }

  // Month labels above the grid.
  const months = weeks.map((col, i) => {
    const first = col[0].date;
    const prev = i > 0 ? weeks[i - 1][0].date : null;
    const show = i === 0 ? false : !prev || first.getUTCMonth() !== prev.getUTCMonth();
    return show ? first.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }) : "";
  });

  const inputStyle = {
    background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "11px 14px", color: "var(--text)", fontSize: 15, fontFamily: "inherit", outline: "none",
  } as const;

  const card = {
    background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px",
  } as const;

  function Stat({ value, label, accent }: { value: number | string; label: string; accent?: boolean }) {
    return (
      <div style={{ ...card, flex: 1, minWidth: 120 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 34, color: accent ? "var(--accent)" : "var(--text)", lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 6 }}>{label}</div>
      </div>
    );
  }

  const CELL = 13, GAP = 3;

  return (
    <div style={{ minHeight: "100vh", padding: "0 24px 80px" }}>
      <div style={{ maxWidth: 760, margin: "0 auto" }}>

        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 28 }}>
          <Link href="/" style={{ color: "var(--text-3)", fontSize: 14, textDecoration: "none" }}>← Repertoires</Link>
          <ThemeToggle />
        </div>

        {/* Masthead */}
        <header style={{ paddingTop: 56, paddingBottom: 28 }}>
          <div style={{ color: "var(--accent)", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>Your account</div>
          <h1 style={{ fontSize: "clamp(38px, 6vw, 56px)", margin: 0 }}>{data.name || "Profile"}</h1>
          <p style={{ marginTop: 14, color: "var(--text-3)", fontSize: 16 }}>
            {data.email} · member since {new Date(data.memberSince).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
        </header>

        {/* Headline stats */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <Stat value={s.repertoires} label={s.repertoires === 1 ? "repertoire" : "repertoires"} />
          <Stat value={s.variations} label="lines" />
          <Stat value={s.moves} label="moves to know" />
          <Stat value={s.dueNow} label="due now" accent={s.dueNow > 0} />
        </div>

        {/* Activity heatmap */}
        <div style={{ ...card, marginTop: 14, overflowX: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
            <span style={{ fontSize: 14, color: "var(--text-2)" }}>Review activity</span>
            <span style={{ fontSize: 13, color: "var(--text-3)" }}>
              {streak > 0 ? <><b style={{ color: "var(--accent)" }}>{streak}-day</b> streak · </> : null}
              {s.totalReviews} reviews · {s.dueWeek} due this week · next {nextReviewLabel}
            </span>
          </div>

          {/* month labels */}
          <div style={{ display: "flex", gap: GAP, marginBottom: 4, paddingLeft: 0 }}>
            {months.map((m, i) => (
              <div key={i} style={{ width: CELL, fontSize: 10, color: "var(--text-4)", overflow: "visible", whiteSpace: "nowrap" }}>{m}</div>
            ))}
          </div>

          {/* grid */}
          <div style={{ display: "flex", gap: GAP }}>
            {weeks.map((col, wi) => (
              <div key={wi} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                {col.map((cell) => (
                  <div
                    key={cell.key}
                    title={cell.future ? "" : `${cell.count} on ${cell.key}`}
                    style={{
                      width: CELL, height: CELL, borderRadius: 3,
                      background: cell.future ? "transparent" : heatColor(cell.count),
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, color: "var(--text-4)" }}>
            <span>Less</span>
            {[0, 2, 5, 9, 12].map((c) => (
              <div key={c} style={{ width: CELL, height: CELL, borderRadius: 3, background: heatColor(c) }} />
            ))}
            <span>More</span>
          </div>
        </div>

        {/* Per-repertoire breakdown */}
        {data.perRepertoire.length > 0 && (
          <div style={{ marginTop: 36 }}>
            <h2 style={{ fontSize: 22, margin: "0 0 14px" }}>By repertoire</h2>
            <div style={{ borderTop: "1px solid var(--border)" }}>
              {data.perRepertoire.map((r) => (
                <Link
                  key={r.id}
                  href={`/repertoire/${r.id}`}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "16px 4px",
                    borderBottom: "1px solid var(--border)", textDecoration: "none", color: "inherit",
                  }}
                >
                  <span style={{ fontSize: 18 }}>{r.color === "white" ? "♔" : "♚"}</span>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: 17, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                  <span style={{ fontSize: 13, color: "var(--text-3)" }}>{r.lines} lines · {r.moves} moves</span>
                  {r.dueNow > 0 && (
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>{r.dueNow} due</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Account management */}
        <div style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: 22, margin: "0 0 16px" }}>Settings</h2>

          <form onSubmit={changePassword} style={{ ...card, display: "flex", flexDirection: "column", gap: 14, maxWidth: 420 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Change password</div>
            <input type="password" placeholder="Current password" value={cur} onChange={(e) => setCur(e.target.value)} required style={inputStyle} />
            <input type="password" placeholder="New password (min. 8)" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} style={inputStyle} />
            {pwMsg && <p style={{ margin: 0, fontSize: 14, color: pwMsg.kind === "ok" ? "var(--success)" : "var(--danger)" }}>{pwMsg.text}</p>}
            <button
              type="submit"
              disabled={saving}
              style={{ alignSelf: "flex-start", padding: "10px 20px", background: "var(--accent)", border: "none", borderRadius: 8, color: "var(--accent-text)", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}
            >
              {saving ? "Saving…" : "Update password"}
            </button>
          </form>

          <div style={{ display: "flex", gap: 16, alignItems: "center", marginTop: 24 }}>
            <button
              onClick={leave}
              style={{ padding: "10px 20px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-2)", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}
            >
              Sign out
            </button>
            <button
              onClick={deleteAccount}
              style={{ background: "none", border: "none", color: "var(--danger)", fontSize: 14, cursor: "pointer", fontFamily: "inherit", padding: "10px 0" }}
            >
              Delete account
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
