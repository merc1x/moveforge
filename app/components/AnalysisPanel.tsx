"use client";

import { useMemo } from "react";
import type { Analysis, EngineStatus } from "@/app/hooks/useStockfish";
import { formatScore, uciLineToSan, whiteBarFraction, type PvMove } from "@/lib/uci";

type Props = {
  // Position on the board; the PV is read from here.
  fen: string;
  enabled: boolean;
  onToggle: () => void;
  status: EngineStatus;
  error: string | null;
  analysis: Analysis | null;
  searching: boolean;
  depth: number;
};

// Stockfish happily returns 30-ply lines; past the first few moves they are
// noise in a 260px sidebar, and the tail changes on every iteration anyway.
const PV_PLIES = 12;

// "1. e4 e5 2. Nf3", or "1… e5 2. Nf3" when the line starts on Black's move.
function formatPv(moves: PvMove[]): string {
  let out = "";
  moves.forEach((m, i) => {
    if (m.color === "w") out += `${out ? " " : ""}${m.moveNumber}. ${m.san}`;
    else if (i === 0) out += `${m.moveNumber}… ${m.san}`;
    else out += ` ${m.san}`;
  });
  return out;
}

export default function AnalysisPanel({
  fen,
  enabled,
  onToggle,
  status,
  error,
  analysis,
  searching,
  depth,
}: Props) {
  // One replay of the line through chess.js per evaluation, not one per render:
  // the panel also re-renders when the engine's status or depth ticks over.
  const { pv, bestSan } = useMemo(() => {
    if (!analysis) return { pv: "", bestSan: null as string | null };
    const moves = uciLineToSan(fen, analysis.pv);
    // bestMove is the head of the PV except right at the end of a search, when
    // the engine's final bestmove can differ from the last PV it printed.
    const best =
      analysis.bestMove && analysis.bestMove !== analysis.pv[0]
        ? uciLineToSan(fen, [analysis.bestMove])[0]?.san ?? null
        : moves[0]?.san ?? null;
    const shown = formatPv(moves.slice(0, PV_PLIES));
    return { pv: moves.length > PV_PLIES ? `${shown} …` : shown, bestSan: best };
  }, [fen, analysis]);

  const whitePct = analysis ? whiteBarFraction(analysis.score) * 100 : 50;
  const score = analysis ? formatScore(analysis.score) : "—";

  // No outer border or background: the sidebar and the trainer's card column
  // frame this differently, so the container owns the chrome.
  return (
    <div style={{ padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, color: "var(--text-4)" }}>Engine</span>
        <button
          onClick={onToggle}
          title={enabled ? "Turn the engine off" : "Analyse this position with Stockfish"}
          style={{
            background: enabled ? "var(--accent-soft)" : "transparent",
            border: `1px solid ${enabled ? "var(--accent-border)" : "var(--border)"}`,
            borderRadius: 999,
            color: enabled ? "var(--accent)" : "var(--text-4)",
            fontSize: 9, fontWeight: 700, letterSpacing: 0.4,
            padding: "3px 9px", cursor: "pointer", fontFamily: "inherit",
          }}
        >
          {enabled ? "ON" : "OFF"}
        </button>
      </div>

      {!enabled ? (
        <div style={{ fontSize: 10, color: "var(--text-4)", marginTop: 6, lineHeight: 1.5 }}>
          Off to save CPU. Turn on for a live evaluation.
        </div>
      ) : status === "error" ? (
        <div style={{ fontSize: 10, color: "var(--danger)", marginTop: 6, lineHeight: 1.5 }}>
          {error ?? "The engine is unavailable."}
        </div>
      ) : (
        <>
          {/* Evaluation bar — White's share of the bar grows to the left. */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <span
              style={{
                fontFamily: "var(--font-display)", fontSize: 17, minWidth: 52,
                color: "var(--text)", fontVariantNumeric: "tabular-nums",
              }}
            >
              {score}
            </span>
            <div
              style={{
                flex: 1, height: 8, borderRadius: 999, overflow: "hidden",
                border: "1px solid var(--border)", background: "#2b2b33",
                display: "flex",
              }}
            >
              <div
                style={{
                  width: `${whitePct}%`, background: "#efe9dd",
                  transition: "width 180ms ease-out",
                }}
              />
            </div>
          </div>

          <div style={{ fontSize: 10, color: "var(--text-4)", marginTop: 6 }}>
            {status === "loading"
              ? "Loading engine (≈7 MB)…"
              : analysis
                ? `depth ${analysis.depth}/${depth}${searching ? " · thinking…" : ""}`
                : searching
                  ? "Thinking…"
                  : "Waiting for a position"}
          </div>

          {analysis && (
            <>
              <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 8 }}>
                Best:{" "}
                <span style={{ color: "var(--accent)", fontWeight: 600 }}>
                  {bestSan ?? analysis.bestMove}
                </span>
              </div>
              {pv && (
                <div
                  style={{
                    fontSize: 10, lineHeight: 1.6, color: "var(--comment)",
                    marginTop: 4, wordBreak: "break-word",
                  }}
                >
                  {pv}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
