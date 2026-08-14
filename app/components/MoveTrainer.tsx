// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Chess, Square } from "chess.js";

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

type Move = {
  id: string;
  fen: string;
  san: string;
  fromSq: string;
  toSq: string;
  order: number;
  comment?: string | null;
  variationId: string;
};

type Variation = {
  id: string;
  name: string;
  moves: Move[];
};

export default function MoveTrainer({
  variation,
  color,
  onNext,
  mode = "train",
  onTrain = null,
  onMovePlayed = null
}: {
  variation: Variation;
  color: string;
  onNext: (() => void) | null;
  mode?: "learn" | "train";
  onTrain?: (() => void) | null;
  onMovePlayed?: ((move: Move | null) => void) | null;
}) {
  const learn = mode === "learn";
  const moves = variation.moves;
  const [moveIdx, setMoveIdx] = useState(0); // next expected move
  const [fen, setFen] = useState(STARTING_FEN);
  const [attempts, setAttempts] = useState(0); // wrong tries on current move
  const [mistakes, setMistakes] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [flashSq, setFlashSq] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [highlights, setHighlights] = useState<Record<string, object>>({});
  const [selectedSq, setSel] = useState<string | null>(null);

  const finished = moves.length > 0 && moveIdx >= moves.length;
  const expected = finished ? null : moves[moveIdx] ?? null;
  const isUserMove = expected
    ? (color === "white") === (moveIdx % 2 === 0)
    : false;
  const lastPlayed = moveIdx > 0 ? moves[moveIdx - 1] : null;

  // Let the parent show the last played move's comment (learn mode notes panel)
  useEffect(() => {
    if (onMovePlayed) onMovePlayed(lastPlayed ?? null);
  }, [moveIdx]);

  // Auto-play opponent moves after a short delay
  useEffect(() => {
    if (!expected || isUserMove) return;
    const t = setTimeout(() => {
      setFen(expected.fen);
      setMoveIdx((i) => i + 1);
    }, 600);
    return () => clearTimeout(t);
  }, [moveIdx, expected, isUserMove]);

  function clearSel() { setHighlights({}); setSel(null); }

  function restart() {
    setMoveIdx(0);
    setFen(STARTING_FEN);
    setAttempts(0);
    setMistakes(0);
    setCorrect(0);
    setShowHint(false);
    setFlashSq(null);
    clearSel();
  }

  function showLegalMoves(sq: string) {
    if (!isUserMove) return;
    const game = new Chess(fen);
    const legal = game.moves({ square: sq as Square, verbose: true });
    if (!legal.length) { clearSel(); return; }
    const h: Record<string, object> = { [sq]: { background: "#c8a96e30" } };
    legal.forEach((m) => {
      h[m.to] = {
        background: game.get(m.to as Square)
          ? "radial-gradient(circle, #00000080 58%, transparent 60%)"
          : "radial-gradient(circle, #00000060 34%, transparent 36%)",
        borderRadius: "50%"
      };
    });
    setHighlights(h);
    setSel(sq);
  }

  function tryMove(from: string, to: string): boolean {
    if (!isUserMove || !expected) return false;
    const game = new Chess(fen);
    let result;
    try { result = game.move({ from, to, promotion: "q" }); } catch { result = null; }
    clearSel();
    if (!result) return false;

    if (result.san === expected.san) {
      setFen(expected.fen);
      setMoveIdx((i) => i + 1);
      setCorrect((c) => c + 1);
      setAttempts(0);
      setShowHint(false);
      setFlashSq(null);
      return true;
    }

    setAttempts((a) => a + 1);
    setMistakes((m) => m + 1);
    setFlashSq(to);
    setTimeout(() => setFlashSq(null), 450);
    return false;
  }

  function onDrop({ sourceSquare, targetSquare }) { return tryMove(sourceSquare, targetSquare); }
  function onPieceDragStart({ square }) { showLegalMoves(square); }
  function onSquareClick({ square: sq }) {
    if (selectedSq && selectedSq !== sq) {
      if (tryMove(selectedSq, sq)) return;
    }
    showLegalMoves(sq);
  }

  const hintFromSq = learn || attempts >= 2 || showHint;
  const hintSan = learn || attempts >= 3 || showHint;

  const sqStyles: Record<string, object> = { ...highlights };
  if (lastPlayed) {
    sqStyles[lastPlayed.fromSq] = { background: "#c8a96e20" };
    sqStyles[lastPlayed.toSq] = { background: "#c8a96e35" };
  }
  if (hintFromSq && expected && isUserMove) {
    sqStyles[expected.fromSq] = { background: "#6699cc45" };
    if (learn) {
      sqStyles[expected.toSq] = {
        background: "radial-gradient(circle, #6699cc70 30%, transparent 34%)"
      };
    }
  }
  if (flashSq) {
    sqStyles[flashSq] = { background: "#e0525255" };
  }

  let statusDot = "var(--accent)";
  let statusText = "Your move";
  if (finished) { statusDot = "var(--success)"; statusText = learn ? "Variation learned" : "Variation complete"; }
  else if (!isUserMove) { statusDot = "var(--text-3)"; statusText = "Opponent replies…"; }
  else if (learn && expected) {
    statusDot = "var(--info)";
    statusText = attempts > 0 ? `Not that one — play ${expected.san}` : `Play ${expected.san}`;
  }
  else if (attempts > 0) { statusDot = "var(--danger)"; statusText = "Wrong move — try again"; }
  if (statusText === "Your move" && hintSan && expected) {
    statusText = `Your move: ${expected.san}`;
  }

  const totalUserMoves = moves.filter(
    (_, i) => (color === "white") === (i % 2 === 0)
  ).length;

  if (moves.length === 0) {
    return (
      <div style={{ color: "var(--text-4)", fontSize: 13 }}>
        This variation has no moves to train yet
      </div>
    );
  }

  const btnStyle = {
    flex: 1, padding: "9px 0", background: "transparent", border: "1px solid var(--border)",
    color: "var(--text-3)", fontSize: 11, cursor: "pointer", borderRadius: 3, fontFamily: "inherit"
  };

  return (
    <div style={{ width: `min(calc(100vh - ${learn ? 180 : 250}px), 100%, 860px)`, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ borderRadius: 4, overflow: "hidden", boxShadow: "var(--board-shadow)", aspectRatio: "1", position: "relative" }}>
        <Chessboard
          options={{
            position: fen,
            onPieceDrop: onDrop,
            onPieceDrag: onPieceDragStart,
            onSquareClick,
            boardStyle: { width: "100%", height: "100%" },
            animationDurationInMs: 120,
            darkSquareStyle: { backgroundColor: "#4a3728" },
            lightSquareStyle: { backgroundColor: "#c8b89a" },
            squareStyles: sqStyles,
            boardOrientation: color === "black" ? "black" : "white",
            allowDragging: isUserMove
          }}
        />
        {finished && (
          <div style={{
            position: "absolute", inset: 0, background: "var(--overlay)",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: "var(--success)" }}>
              ✓ {learn ? "Variation learned" : "Variation complete"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-2)" }}>
              {learn
                ? `${moves.length} moves played through`
                : `${correct} correct · ${mistakes} ${mistakes === 1 ? "mistake" : "mistakes"}`}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {learn && onTrain && (
                <button
                  onClick={onTrain}
                  style={{
                    padding: "9px 20px", background: "var(--accent)", border: "none", borderRadius: 3,
                    color: "var(--accent-text)", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
                  }}
                >
                  Train it →
                </button>
              )}
              <button
                onClick={restart}
                style={{
                  padding: "9px 20px",
                  background: learn && onTrain ? "transparent" : "var(--accent)",
                  border: learn && onTrain ? "1px solid var(--accent-border)" : "none",
                  borderRadius: 3,
                  color: learn && onTrain ? "var(--accent)" : "var(--bg)",
                  fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit"
                }}
              >
                Repeat
              </button>
              {onNext && (
                <button
                  onClick={onNext}
                  style={{
                    padding: "9px 20px", background: "transparent", border: "1px solid var(--accent-border)",
                    borderRadius: 3, color: "var(--accent)", fontSize: 11, fontWeight: 700,
                    cursor: "pointer", fontFamily: "inherit"
                  }}
                >
                  Next variation →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
        background: "var(--panel)", borderRadius: 4, border: "1px solid var(--border)",
        fontSize: 11 }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: statusDot, flexShrink: 0 }} />
        <span>{statusText}</span>
        <span style={{ marginLeft: "auto", color: "var(--text-3)", textTransform: "none" }}>
          {correct}/{totalUserMoves} · {mistakes} ✕
        </span>
      </div>

      {/* Train mode only (sidebar hidden there); fixed height so the board doesn't shift */}
      {!learn && (
        <div style={{
          height: 56, boxSizing: "border-box", overflowY: "auto",
          padding: "9px 14px", background: "var(--panel)", border: "1px solid var(--border)",
          borderRadius: 4, fontSize: 11, lineHeight: 1.6, color: "var(--comment)", fontStyle: "italic"
        }}>
          {lastPlayed?.comment ?? ""}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        {!learn && (
        <button
          onClick={() => setShowHint(true)}
          disabled={!isUserMove || finished}
          style={{ ...btnStyle, opacity: !isUserMove || finished ? 0.4 : 1 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--info)"; e.currentTarget.style.borderColor = "var(--info-border)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          Hint
        </button>
        )}
        <button
          onClick={restart}
          style={btnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-border)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          Restart
        </button>
        {onNext && (
          <button
            onClick={onNext}
            style={btnStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-border)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >
            Skip →
          </button>
        )}
      </div>
    </div>
  );
}
