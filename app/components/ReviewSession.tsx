// @ts-nocheck
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Chess, Square } from "chess.js";
import { gradeFromAttempts } from "@/lib/sm2";

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export type ReviewMove = {
  moveId: string;
  san: string;
  fromSq: string;
  toSq: string;
  fen: string; // position AFTER this move
  comment: string | null;
  isUserMove: boolean;
};

export type ReviewLine = {
  variationId: string;
  variationName: string;
  moves: ReviewMove[];
};

export default function ReviewSession({
  repertoireId,
  repertoireName,
  color,
  lines,
}: {
  repertoireId: string;
  repertoireName: string;
  color: string;
  lines: ReviewLine[];
}) {
  const router = useRouter();

  const total = lines.length;
  const [lineIdx, setLineIdx] = useState(0);
  const [moveIdx, setMoveIdx] = useState(0); // next move to play in the current line
  const [fen, setFen] = useState(STARTING_FEN);
  const [attempts, setAttempts] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [graded, setGraded] = useState({ good: 0, hard: 0, again: 0 });
  const [highlights, setHighlights] = useState<Record<string, object>>({});
  const [selectedSq, setSel] = useState<string | null>(null);
  const [flashSq, setFlashSq] = useState<string | null>(null);

  const finished = lineIdx >= total;
  const line = finished ? null : lines[lineIdx];
  const expected = line ? line.moves[moveIdx] ?? null : null;
  const lastPlayed = line && moveIdx > 0 ? line.moves[moveIdx - 1] : null;
  const isUserTurn = !!expected && expected.isUserMove;

  function clearSel() { setHighlights({}); setSel(null); }

  // Auto-play the opponent's moves with a short pause.
  useEffect(() => {
    if (!expected || expected.isUserMove) return;
    const t = setTimeout(() => {
      setFen(expected.fen);
      setMoveIdx((i) => i + 1);
    }, 550);
    return () => clearTimeout(t);
  }, [lineIdx, moveIdx]);

  // End of a line → advance to the next one (pause longer if there's a note).
  useEffect(() => {
    if (!line || moveIdx < line.moves.length) return;
    const t = setTimeout(() => {
      setLineIdx((i) => i + 1);
      setMoveIdx(0);
      setFen(STARTING_FEN);
      setAttempts(0);
      setRevealed(false);
      setFlashSq(null);
      clearSel();
    }, lastPlayed?.comment ? 1200 : 650);
    return () => clearTimeout(t);
  }, [lineIdx, moveIdx]);

  function persistGrade(move: ReviewMove, wrongAttempts: number) {
    const quality = gradeFromAttempts(wrongAttempts);
    setGraded((g) => ({
      good: g.good + (quality >= 4 ? 1 : 0),
      hard: g.hard + (quality === 3 ? 1 : 0),
      again: g.again + (quality < 3 ? 1 : 0),
    }));
    fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveId: move.moveId, quality }),
    }).catch(console.error);
  }

  function tryMove(from: string, to: string): boolean {
    if (!isUserTurn || !expected) return false;
    const game = new Chess(fen);
    let result;
    try { result = game.move({ from, to, promotion: "q" }); } catch { result = null; }
    clearSel();
    if (!result) return false;

    if (result.san === expected.san) {
      persistGrade(expected, revealed ? 99 : attempts);
      setFen(expected.fen);
      setMoveIdx((i) => i + 1);
      setAttempts(0);
      setRevealed(false);
      setFlashSq(null);
      return true;
    }

    setAttempts((a) => a + 1);
    setFlashSq(to);
    setTimeout(() => setFlashSq(null), 450);
    return false;
  }

  function showLegal(sq: string) {
    if (!isUserTurn) return;
    const game = new Chess(fen);
    const legal = game.moves({ square: sq as Square, verbose: true });
    if (!legal.length) { clearSel(); return; }
    const h: Record<string, object> = { [sq]: { background: "var(--accent-soft)" } };
    legal.forEach((m) => {
      h[m.to] = {
        background: game.get(m.to as Square)
          ? "radial-gradient(circle, #00000080 58%, transparent 60%)"
          : "radial-gradient(circle, #00000060 34%, transparent 36%)",
        borderRadius: "50%",
      };
    });
    setHighlights(h);
    setSel(sq);
  }

  function onDrop({ sourceSquare, targetSquare }) { return tryMove(sourceSquare, targetSquare); }
  function onPieceDragStart({ square }) { showLegal(square); }
  function onSquareClick({ square: sq }) {
    if (selectedSq && selectedSq !== sq) { if (tryMove(selectedSq, sq)) return; }
    showLegal(sq);
  }

  const sqStyles = useMemo(() => {
    const s: Record<string, object> = { ...highlights };
    // Show what the opponent just played, for context.
    if (isUserTurn && lastPlayed && !lastPlayed.isUserMove) {
      s[lastPlayed.fromSq] = { background: "var(--accent-soft)" };
      s[lastPlayed.toSq] = { background: "var(--accent-soft)" };
    }
    // Reveal the answer (or nudge after misses).
    if (isUserTurn && (revealed || attempts >= 2) && expected) {
      s[expected.fromSq] = { background: "#6699cc45" };
      if (revealed) s[expected.toSq] = { background: "radial-gradient(circle, #6699cc70 30%, transparent 34%)" };
    }
    if (flashSq) s[flashSq] = { background: "#e0525255" };
    return s;
  }, [highlights, lineIdx, moveIdx, revealed, attempts, flashSq]);

  const headerBtn = {
    background: "none", border: "none", color: "var(--text-3)", fontSize: 14, cursor: "pointer",
    fontFamily: "inherit", padding: 0,
  } as const;

  // ── Empty state ───────────────────────────────────────────────────────────
  if (total === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
        <div style={{ fontSize: 40 }}>✓</div>
        <h2 style={{ fontSize: 30, margin: 0, color: "var(--success)" }}>Nothing due right now</h2>
        <div style={{ fontSize: 15, color: "var(--text-3)" }}>{repertoireName} — all caught up.</div>
        <button onClick={() => router.push(`/repertoire/${repertoireId}`)} style={{ ...headerBtn, marginTop: 8, color: "var(--accent)" }}>
          ← Back to repertoire
        </button>
      </div>
    );
  }

  const status: { dot: string; text: string; move?: string; hint?: string } = (() => {
    if (finished) return { dot: "var(--success)", text: "Session complete" };
    if (!expected) return { dot: "var(--success)", text: "Line complete" };
    if (!isUserTurn) return { dot: "var(--text-4)", text: "Opponent replies…" };
    if (revealed) return { dot: "var(--info)", text: "Answer", move: expected.san, hint: "— play it" };
    if (attempts > 0) return { dot: "var(--danger)", text: "Not that move — try again" };
    return { dot: "var(--accent)", text: "Your move" };
  })();

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)", fontFamily: "var(--font-body)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
        <button onClick={() => router.push(`/repertoire/${repertoireId}`)} style={headerBtn}>← Exit</button>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 17, color: "var(--text)" }}>{repertoireName}</div>
        <div style={{ fontSize: 13, color: "var(--text-4)" }}>Review</div>
        <div style={{ marginLeft: "auto", fontSize: 14, color: "var(--text-3)" }}>
          line {Math.min(lineIdx + 1, total)} / {total}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "var(--border-soft)" }}>
        <div style={{ height: "100%", width: `${total ? (lineIdx / total) * 100 : 0}%`, background: "var(--accent)", transition: "width 0.3s" }} />
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        {finished ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: 40 }}>✓</div>
            <h2 style={{ fontSize: 32, margin: 0, color: "var(--success)" }}>Session complete</h2>
            <div style={{ display: "flex", gap: 28, fontSize: 15, color: "var(--text-2)" }}>
              <span><b style={{ color: "var(--success)" }}>{graded.good}</b> good</span>
              <span><b style={{ color: "var(--info)" }}>{graded.hard}</b> hard</span>
              <span><b style={{ color: "var(--danger)" }}>{graded.again}</b> again</span>
            </div>
            <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
              <button
                onClick={() => router.push(`/repertoire/${repertoireId}`)}
                style={{ padding: "11px 24px", background: "var(--accent)", border: "none", borderRadius: 8, color: "var(--accent-text)", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                Done
              </button>
              <button
                onClick={() => router.refresh()}
                style={{ padding: "11px 24px", background: "transparent", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-3)", fontSize: 15, cursor: "pointer", fontFamily: "inherit" }}
              >
                Check again
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 32, maxWidth: "100%" }}>
            {/* Board */}
            <div style={{
              width: "min(calc(100vh - 150px), calc(100vw - 440px), 760px)", aspectRatio: "1",
              borderRadius: 6, overflow: "hidden", boxShadow: "var(--board-shadow)", flexShrink: 0,
            }}>
              <Chessboard
                options={{
                  position: fen,
                  onPieceDrop: onDrop,
                  onPieceDrag: onPieceDragStart,
                  onSquareClick,
                  boardStyle: { width: "100%", height: "100%" },
                  animationDurationInMs: 150,
                  darkSquareStyle: { backgroundColor: "#4a3728" },
                  lightSquareStyle: { backgroundColor: "#c8b89a" },
                  squareStyles: sqStyles,
                  boardOrientation: color === "black" ? "black" : "white",
                  allowDragging: isUserTurn,
                }}
              />
            </div>

            {/* Right panel: variation, move, answer */}
            <div style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ fontFamily: "var(--font-display)", fontSize: 24, color: "var(--text)", lineHeight: 1.15 }}>
                {line?.variationName}
              </div>

              <div style={{ padding: "18px 20px", background: "var(--panel)", borderRadius: 10, border: "1px solid var(--border)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 9, height: 9, borderRadius: "50%", background: status.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: 15, fontWeight: 500 }}>{status.text}</span>
                </div>
                {status.move && (
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 40, color: "var(--accent)", marginTop: 10 }}>
                    {status.move}
                    {status.hint && <span style={{ fontFamily: "var(--font-body)", fontSize: 14, fontWeight: 400, color: "var(--text-3)", marginLeft: 10 }}>{status.hint}</span>}
                  </div>
                )}
                {lastPlayed?.comment && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--border)", color: "var(--comment)", fontStyle: "italic", fontSize: 14, lineHeight: 1.55 }}>
                    {lastPlayed.comment}
                  </div>
                )}
              </div>

              {isUserTurn && (
                <button
                  onClick={() => setRevealed(true)}
                  disabled={revealed}
                  style={{ padding: "12px 0", background: "transparent", border: "1px solid var(--border)", color: "var(--text-3)", fontSize: 14, cursor: revealed ? "default" : "pointer", borderRadius: 8, fontFamily: "inherit", opacity: revealed ? 0.4 : 1 }}
                >
                  Show answer
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
