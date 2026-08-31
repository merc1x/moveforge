// @ts-nocheck
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Chess, Square } from "chess.js";
import PromotionPicker from "./PromotionPicker";
import AnalysisPanel from "./AnalysisPanel";
import { useStockfish, ANALYSIS_DEPTH } from "@/app/hooks/useStockfish";
import { isPromotion, sideToMove, type PromotionPiece } from "@/lib/chess";

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
  onLearned = null
}: {
  variation: Variation;
  color: string;
  onNext: (() => void) | null;
  mode?: "learn" | "train";
  onTrain?: (() => void) | null;
  onLearned?: (() => void) | null;
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
  const [pendingPromo, setPendingPromo] = useState<{ from: string; to: string } | null>(null);
  // Learn flow per move: demo (shown) → explain (only if it has a note) → replay.
  const [phase, setPhase] = useState<"demo" | "explain" | "replay">("demo");
  const [animMs, setAnimMs] = useState(120); // board animation; 0 = instant (teleport)
  // Post-run engine review: step back through the line you just learned before
  // committing to the next variation. Only reachable once the run is finished.
  const [analysing, setAnalysing] = useState(false);
  const [engineOn, setEngineOn] = useState(true);
  const [reviewIdx, setReviewIdx] = useState(-1); // -1 = starting position

  const finished = moves.length > 0 && moveIdx >= moves.length;
  const expected = finished ? null : moves[moveIdx] ?? null;
  const isUserMove = expected
    ? (color === "white") === (moveIdx % 2 === 0)
    : false;
  const lastPlayed = moveIdx > 0 ? moves[moveIdx - 1] : null;
  // Input is blocked until you reach the replay phase of your move.
  const demoing = learn && isUserMove && !finished && phase !== "replay";

  // Finishing a learn run enrolls the variation into the SRS (parent persists it).
  useEffect(() => {
    if (finished && learn && onLearned) onLearned();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  // Auto-play opponent moves after a short delay
  useEffect(() => {
    if (!expected || isUserMove) return;
    const t = setTimeout(() => {
      setFen(expected.fen);
      setMoveIdx((i) => i + 1);
    }, 600);
    return () => clearTimeout(t);
  }, [moveIdx, expected, isUserMove]);

  // Each time a new move of yours comes up, restart its learn cycle at "demo".
  useEffect(() => {
    if (learn && isUserMove && !finished) setPhase("demo");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moveIdx]);

  // Demonstrate the move (play it). Then pause to explain if it has a note,
  // otherwise go straight to the replay.
  useEffect(() => {
    if (!learn || phase !== "demo" || !isUserMove || finished || !expected) return;
    const t1 = setTimeout(() => setFen(expected.fen), 300);
    const t2 = setTimeout(() => {
      if (expected.comment) setPhase("explain");
      else startReplay();
    }, 1100);
    return () => { clearTimeout(t1); clearTimeout(t2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, moveIdx]);

  // Hand control back to you: replay the opponent's move (animated) to reset the
  // position, then wait for you to play your move.
  function startReplay() {
    const beforeFen = moveIdx > 0 ? moves[moveIdx - 1].fen : STARTING_FEN;
    const oppBefore = moveIdx >= 2 ? moves[moveIdx - 2].fen : STARTING_FEN;
    setAnimMs(0);
    setFen(moveIdx > 0 ? oppBefore : STARTING_FEN);
    setTimeout(() => { setAnimMs(120); setFen(beforeFen); }, 80);
    setPendingPromo(null);
    clearSel();
    setPhase("replay");
  }

  function clearSel() { setHighlights({}); setSel(null); }

  function restart() {
    setMoveIdx(0);
    setFen(STARTING_FEN);
    setAttempts(0);
    setMistakes(0);
    setCorrect(0);
    setShowHint(false);
    setFlashSq(null);
    setAnimMs(120);
    setPhase("demo");
    setPendingPromo(null);
    setAnalysing(false);
    clearSel();
  }

  // ── Post-run engine review ────────────────────────────────────────────────
  // Drives the board off reviewIdx instead of the training flow. Safe because
  // every trainer effect is gated on `expected`, which is null once finished.
  function reviewGoTo(index: number) {
    const idx = Math.max(-1, Math.min(moves.length - 1, index));
    setReviewIdx(idx);
    setAnimMs(120);
    setFen(idx === -1 ? STARTING_FEN : moves[idx].fen);
    setPendingPromo(null);
    clearSel();
  }

  function startAnalysis() {
    setEngineOn(true);
    setAnalysing(true);
    reviewGoTo(moves.length - 1); // open on the final position
  }

  const engine = useStockfish({
    fen,
    enabled: analysing && engineOn,
    depth: ANALYSIS_DEPTH,
  });

  // Arrow keys walk the line while reviewing.
  useEffect(() => {
    if (!analysing) return;
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); reviewGoTo(reviewIdx - 1); break;
        case "ArrowRight": e.preventDefault(); reviewGoTo(reviewIdx + 1); break;
        case "ArrowUp": e.preventDefault(); reviewGoTo(-1); break;
        case "ArrowDown": e.preventDefault(); reviewGoTo(moves.length - 1); break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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

  function tryMove(from: string, to: string, promotion?: PromotionPiece): boolean {
    if (!isUserMove || !expected || demoing) return false;
    // Ask which piece before playing a promotion — the wrong choice is a wrong move.
    if (!promotion && isPromotion(fen, from, to)) {
      setPendingPromo({ from, to });
      clearSel();
      return true;
    }
    const game = new Chess(fen);
    let result;
    try { result = game.move({ from, to, promotion: promotion ?? "q" }); } catch { result = null; }
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

  function onDrop({ sourceSquare, targetSquare }) {
    const ok = tryMove(sourceSquare, targetSquare);
    // A promotion only opens the picker, so report the drop as rejected and let
    // the pawn snap back until a piece is chosen.
    return ok && !isPromotion(fen, sourceSquare, targetSquare);
  }
  function onPieceDragStart({ square }) { showLegalMoves(square); }
  function onSquareClick({ square: sq }) {
    if (selectedSq && selectedSq !== sq) {
      if (tryMove(selectedSq, sq)) return;
    }
    showLegalMoves(sq);
  }

  const hintSan = !learn && (attempts >= 3 || showHint); // train-only SAN reveal in status

  // While reviewing, the tint follows the move you have stepped to, not the
  // last one played in the run.
  const tintMove = analysing ? (reviewIdx >= 0 ? moves[reviewIdx] : null) : lastPlayed;
  const sqStyles: Record<string, object> = { ...highlights };
  if (tintMove) {
    sqStyles[tintMove.fromSq] = { background: "#c8a96e20" };
    sqStyles[tintMove.toSq] = { background: "#c8a96e35" };
  }
  // Train: nudge with the from-square after misses or "Show answer".
  if (!learn && expected && isUserMove && (attempts >= 2 || showHint)) {
    sqStyles[expected.fromSq] = { background: "#6699cc45" };
  }
  // Learn: while showing/explaining, mark the demonstrated move. In the replay
  // phase nothing is marked — you recall it yourself.
  if (learn && expected && isUserMove && phase !== "replay") {
    sqStyles[expected.fromSq] = { background: "#6699cc40" };
    sqStyles[expected.toSq] = { background: "#6699cc55" };
  }
  if (flashSq) {
    sqStyles[flashSq] = { background: "#e0525255" };
  }

  let statusDot = "var(--accent)";
  let statusText = "Your move";
  if (analysing) {
    statusDot = "var(--info)";
    const m = reviewIdx >= 0 ? moves[reviewIdx] : null;
    statusText = m
      ? `Reviewing ${Math.ceil((reviewIdx + 1) / 2)}.${reviewIdx % 2 === 0 ? "" : ".."} ${m.san}`
      : "Reviewing the starting position";
  }
  else if (finished) { statusDot = "var(--success)"; statusText = learn ? "Variation learned" : "Variation complete"; }
  else if (!isUserMove) { statusDot = "var(--text-3)"; statusText = "Opponent replies…"; }
  else if (learn && expected) {
    statusDot = "var(--info)";
    statusText = phase === "demo" ? "Watch"
      : phase === "explain" ? "Read the note"
      : attempts > 0 ? "Not that move — try again" : "Your move — play it";
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
    width: "100%", padding: "10px 0", background: "transparent", border: "1px solid var(--border)",
    color: "var(--text-3)", fontSize: 12, cursor: "pointer", borderRadius: 6, fontFamily: "inherit"
  };

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      {/* Board */}
      <div style={{
        width: "min(calc(100vh - 130px), calc(100vw - 640px), 760px)", aspectRatio: "1", flexShrink: 0,
        borderRadius: 4, overflow: "hidden", boxShadow: "var(--board-shadow)", position: "relative"
      }}>
        <Chessboard
          options={{
            position: fen,
            onPieceDrop: onDrop,
            onPieceDrag: onPieceDragStart,
            onSquareClick,
            boardStyle: { width: "100%", height: "100%" },
            animationDurationInMs: animMs,
            darkSquareStyle: { backgroundColor: "#a87d54" },
            lightSquareStyle: { backgroundColor: "#e3cdab" },
            squareStyles: sqStyles,
            boardOrientation: color === "black" ? "black" : "white",
            allowDragging: isUserMove && !demoing
          }}
        />
        {pendingPromo && (
          <PromotionPicker
            square={pendingPromo.to}
            color={sideToMove(fen)}
            orientation={color === "black" ? "black" : "white"}
            onSelect={(piece) => {
              const { from, to } = pendingPromo;
              setPendingPromo(null);
              tryMove(from, to, piece);
            }}
            onCancel={() => setPendingPromo(null)}
          />
        )}
        {finished && !analysing && (
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
            <button
              onClick={startAnalysis}
              style={{
                background: "none", border: "none", color: "var(--text-3)", fontSize: 11,
                cursor: "pointer", fontFamily: "inherit", textDecoration: "underline",
                textUnderlineOffset: 3, padding: 0
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; }}
            >
              ⌕ Analyse this line first
            </button>
          </div>
        )}
      </div>

      {/* Right text panel */}
      <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ padding: "14px 16px", background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: statusDot, flexShrink: 0 }} />
            <span style={{ fontSize: 15, fontWeight: 500 }}>{statusText}</span>
          </div>
          {/* Train: the move you just played. Learn: only while explaining, the
              note for the demonstrated move. */}
          {((!learn && lastPlayed?.comment) || (learn && phase === "explain" && expected?.comment)) && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", color: "var(--text-2)", fontSize: 15, lineHeight: 1.6 }}>
              {learn ? expected?.comment : lastPlayed?.comment}
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 12, color: "var(--text-4)" }}>
            {correct}/{totalUserMoves} correct · {mistakes} wrong
          </div>
        </div>

        {/* Engine review of the line you just learned */}
        {analysing && (
          <>
            <div style={{ background: "var(--panel)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <AnalysisPanel
                fen={fen}
                enabled={engineOn}
                onToggle={() => setEngineOn((v) => !v)}
                status={engine.status}
                error={engine.error}
                analysis={engine.analysis}
                searching={engine.searching}
                depth={ANALYSIS_DEPTH}
              />
            </div>

            {/* Step through the line — buttons mirror the arrow keys */}
            <div style={{ display: "flex", gap: 6 }}>
              {([
                ["⟨⟨", () => reviewGoTo(-1)],
                ["⟨", () => reviewGoTo(reviewIdx - 1)],
                ["⟩", () => reviewGoTo(reviewIdx + 1)],
                ["⟩⟩", () => reviewGoTo(moves.length - 1)],
              ] as [string, () => void][]).map(([label, fn], i) => (
                <button
                  key={i}
                  onClick={fn}
                  style={{ ...btnStyle, padding: "8px 0", fontSize: 13 }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-border)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* The comment you were taught for the move you are standing on */}
            {reviewIdx >= 0 && moves[reviewIdx]?.comment && (
              <div style={{
                padding: "12px 14px", background: "var(--panel)", border: "1px solid var(--border)",
                borderRadius: 8, fontSize: 12, lineHeight: 1.6, color: "var(--comment)", fontStyle: "italic"
              }}>
                {moves[reviewIdx].comment}
              </div>
            )}

            <button
              onClick={() => setAnalysing(false)}
              style={btnStyle}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.borderColor = "var(--accent-border)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-3)"; e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              ← Back to summary
            </button>
            {onNext && (
              <button
                onClick={onNext}
                style={{
                  ...btnStyle, background: "var(--accent)", border: "none",
                  color: "var(--accent-text)", fontWeight: 700
                }}
              >
                Next variation →
              </button>
            )}
          </>
        )}

        {learn && phase === "explain" && (
          <button
            onClick={startReplay}
            style={{
              width: "100%", padding: "11px 0", background: "var(--accent)", border: "none",
              borderRadius: 8, color: "var(--accent-text)", fontSize: 14, fontWeight: 600,
              cursor: "pointer", fontFamily: "inherit"
            }}
          >
            Continue →
          </button>
        )}

        {/* Hidden while reviewing — the review block carries its own actions */}
        <div style={{ display: analysing ? "none" : "flex", flexDirection: "column", gap: 8 }}>
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
    </div>
  );
}
