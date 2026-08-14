// @ts-nocheck
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Chess, Square } from "chess.js";

const Chessboard = dynamic(
  () => import("react-chessboard").then((m) => m.Chessboard),
  { ssr: false }
);

type Move = {
  id: string;
  fen: string;
  san: string;
  fromSq: string;
  toSq: string;
  order: number;
  variationId: string;
};

type Variation = {
  id: string;
  name: string;
  moves: Move[];
};

type Repertoire = {
  id: string;
  name: string;
  color: string;
  variations: Variation[];
};

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function RepertoireEditor({ repertoire }: { repertoire: Repertoire }) {
  const router = useRouter();
  const [variations, setVariations] = useState<Variation[]>(repertoire.variations);
  const [selectedId, setSelectedId] = useState<string | null>(
    repertoire.variations[0]?.id ?? null
  );
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [fen, setFen] = useState(STARTING_FEN);
  const [highlights, setHighlights] = useState<Record<string, object>>({});
  const [selectedSq, setSel] = useState<string | null>(null);
  const [newVarName, setNewVarName] = useState("");
  const [showNewVar, setShowNewVar] = useState(false);
  const [creating, setCreating] = useState(false);

  const selectedVar = variations.find((v) => v.id === selectedId) ?? null;
  const moves = selectedVar?.moves ?? [];
  const currentMove = currentIndex >= 0 ? (moves[currentIndex] ?? null) : null;

  function selectVariation(id: string) {
    setSelectedId(id);
    setCurrentIndex(-1);
    setFen(STARTING_FEN);
    setHighlights({});
    setSel(null);
  }

  function navigateTo(index: number) {
    if (index < -1 || index >= moves.length) return;
    setCurrentIndex(index);
    setFen(index === -1 ? STARTING_FEN : moves[index].fen);
    setHighlights({});
    setSel(null);
  }

  function clearSel() { setHighlights({}); setSel(null); }

  function showLegalMoves(sq: string) {
    const game = new Chess(fen);
    const legal = game.moves({ square: sq as Square, verbose: true });
    if (!legal.length) { clearSel(); return; }
    const h: Record<string, object> = { [sq]: { background: "#c8a96e30" } };
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

  function applyMove(from: string, to: string): boolean {
    if (!selectedId) return false;
    const game = new Chess(fen);
    let result;
    try { result = game.move({ from, to, promotion: "q" }); } catch { return false; }
    if (!result) return false;

    const newFen = game.fen();
    const newOrder = currentIndex + 2; // 1-indexed; currentIndex=-1 → order=1

    // If the next move already in the variation is the same, just advance
    const nextMove = moves[currentIndex + 1];
    if (nextMove?.san === result.san) {
      setFen(newFen);
      setCurrentIndex(currentIndex + 1);
      clearSel();
      return true;
    }

    // Truncate local state at this point, then optimistically append
    const tempId = "tmp_" + Date.now();
    const tempMove: Move = {
      id: tempId,
      fen: newFen,
      san: result.san,
      fromSq: result.from,
      toSq: result.to,
      order: newOrder,
      variationId: selectedId,
    };
    const newMoves = [...moves.slice(0, currentIndex + 1), tempMove];
    setVariations((prev) =>
      prev.map((v) => (v.id === selectedId ? { ...v, moves: newMoves } : v))
    );
    setFen(newFen);
    setCurrentIndex(currentIndex + 1);
    clearSel();

    fetch("/api/moves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fen: newFen,
        san: result.san,
        fromSq: result.from,
        toSq: result.to,
        order: newOrder,
        variationId: selectedId,
      }),
    })
      .then((r) => r.json())
      .then((saved: Move) => {
        setVariations((prev) =>
          prev.map((v) => {
            if (v.id !== selectedId) return v;
            return { ...v, moves: v.moves.map((m) => (m.id === tempId ? saved : m)) };
          })
        );
      })
      .catch(console.error);

    return true;
  }

  async function createVariation() {
    const name = newVarName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch("/api/variations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, repertoireId: repertoire.id }),
      });
      if (!res.ok) return;
      const created = await res.json();
      const withMoves: Variation = { ...created, moves: [] };
      setVariations((prev) => [...prev, withMoves]);
      setNewVarName("");
      setShowNewVar(false);
      selectVariation(withMoves.id);
    } finally {
      setCreating(false);
    }
  }

  function onDrop({ sourceSquare, targetSquare }) {
    return applyMove(sourceSquare, targetSquare);
  }
  function onPieceDragStart({ square }) { showLegalMoves(square); }
  function onSquareClick({ square: sq }) {
    if (selectedSq && selectedSq !== sq) {
      if (applyMove(selectedSq, sq)) return;
    }
    showLegalMoves(sq);
  }

  const sqStyles = { ...highlights };
  if (currentMove) {
    sqStyles[currentMove.fromSq] = { background: "#c8a96e20" };
    sqStyles[currentMove.toSq] = { background: "#c8a96e35" };
  }

  // Group moves into pairs: { num, white: Move, black?: Move }
  const movePairs = moves.reduce<{ num: number; white: Move; black?: Move }[]>((acc, m, i) => {
    if (i % 2 === 0) acc.push({ num: i / 2 + 1, white: m, black: moves[i + 1] });
    return acc;
  }, []);

  // ── Shared style helpers ──────────────────────────────────────────────────
  const border = "1px solid #1e1e1e";

  function moveChip(moveIndex: number, san: string) {
    const active = moveIndex === currentIndex;
    return (
      <span
        onClick={() => navigateTo(moveIndex)}
        style={{
          padding: "2px 6px", borderRadius: 3, cursor: "pointer", fontSize: 12,
          minWidth: 48, display: "inline-block",
          color: active ? "#c8a96e" : "#888",
          background: active ? "#c8a96e22" : "transparent",
          fontWeight: active ? 600 : 400,
        }}
      >
        {san}
      </span>
    );
  }

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden",
      background: "#0f0f0f", color: "#e8e0d0",
      fontFamily: "'IBM Plex Mono', monospace",
    }}>

      {/* ── Left sidebar: variation list ─────────────────────────────────── */}
      <div style={{ width: 250, flexShrink: 0, borderRight: border, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Back + repertoire name */}
        <div style={{ padding: "14px 16px", borderBottom: border }}>
          <button
            onClick={() => router.push("/")}
            style={{ background: "none", border: "none", color: "#555", fontSize: 11, cursor: "pointer", letterSpacing: "0.08em", textTransform: "uppercase", fontFamily: "inherit", padding: 0 }}
          >
            ← All Repertoires
          </button>
          <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>{repertoire.name}</div>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.08em", textTransform: "uppercase", marginTop: 3 }}>
            {repertoire.color === "white" ? "♔ White" : "♚ Black"}
          </div>
        </div>

        {/* New variation */}
        <div style={{ padding: "12px 16px", borderBottom: border }}>
          {showNewVar ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input
                value={newVarName}
                onChange={(e) => setNewVarName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createVariation();
                  if (e.key === "Escape") { setShowNewVar(false); setNewVarName(""); }
                }}
                placeholder="Variation name"
                autoFocus
                style={{
                  background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 3,
                  padding: "7px 10px", color: "#e8e0d0", fontSize: 12,
                  fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={createVariation}
                  disabled={creating || !newVarName.trim()}
                  style={{
                    flex: 1, padding: "8px 0", background: "#c8a96e", border: "none",
                    borderRadius: 3, color: "#0f0f0f", fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                    fontFamily: "inherit", opacity: (creating || !newVarName.trim()) ? 0.5 : 1,
                  }}
                >
                  {creating ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => { setShowNewVar(false); setNewVarName(""); }}
                  style={{
                    padding: "8px 12px", background: "transparent", border: "1px solid #2a2a2a",
                    borderRadius: 3, color: "#555", fontSize: 11, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewVar(true)}
              style={{
                width: "100%", padding: "8px 0", background: "#c8a96e", border: "none",
                borderRadius: 3, color: "#0f0f0f", fontSize: 11, fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              + New Variation
            </button>
          )}
        </div>

        {/* Variation list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {variations.length === 0 && (
            <div style={{ padding: "24px 16px", color: "#333", fontSize: 12, textAlign: "center" }}>
              No variations yet
            </div>
          )}
          {variations.map((v) => {
            const active = v.id === selectedId;
            return (
              <div
                key={v.id}
                onClick={() => selectVariation(v.id)}
                style={{
                  padding: "10px 16px", cursor: "pointer",
                  borderLeft: active ? "2px solid #c8a96e" : "2px solid transparent",
                  background: active ? "#c8a96e0d" : "transparent",
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = "#ffffff08"; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 12, color: active ? "#e8e0d0" : "#777", fontWeight: active ? 600 : 400 }}>
                  {v.name}
                </div>
                <div style={{ fontSize: 10, color: "#444", marginTop: 2 }}>
                  {v.moves.length} {v.moves.length === 1 ? "move" : "moves"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Center: board ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16, minWidth: 0 }}>
        {!selectedVar ? (
          <div style={{ color: "#333", fontSize: 13 }}>Select or create a variation to start</div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {selectedVar.name}
            </div>
            <div style={{ borderRadius: 4, overflow: "hidden", boxShadow: "0 0 0 1px #2a2a2a, 0 24px 64px #000a" }}>
              <Chessboard
                options={{
                  position: fen,
                  onPieceDrop: onDrop,
                  onPieceDrag: onPieceDragStart,
                  onSquareClick,
                  boardStyle: { width: 460, height: 460 },
                  animationDurationInMs: 80,
                  darkSquareStyle: { backgroundColor: "#4a3728" },
                  lightSquareStyle: { backgroundColor: "#c8b89a" },
                  squareStyles: sqStyles,
                  boardOrientation: repertoire.color === "black" ? "black" : "white",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, width: 460 }}>
              {([
                ["⟨⟨", () => navigateTo(-1)],
                ["⟨", () => navigateTo(currentIndex - 1)],
                ["⟩", () => navigateTo(currentIndex + 1)],
                ["⟩⟩", () => navigateTo(moves.length - 1)],
              ] as [string, () => void][]).map(([label, fn], i) => (
                <button
                  key={i}
                  onClick={fn}
                  style={{
                    flex: 1, padding: "9px 0", background: "transparent", border: "1px solid #2a2a2a",
                    color: "#666", fontSize: 14, cursor: "pointer", borderRadius: 3, fontFamily: "inherit",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#c8a96e"; e.currentTarget.style.borderColor = "#c8a96e44"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "#666"; e.currentTarget.style.borderColor = "#2a2a2a"; }}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Right sidebar: move list ──────────────────────────────────────── */}
      <div style={{ width: 200, flexShrink: 0, borderLeft: border, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", borderBottom: border, fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase", color: "#444" }}>
          Move List
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "6px 0" }}>
          {/* Start position */}
          <div
            onClick={() => navigateTo(-1)}
            style={{
              padding: "3px 12px", cursor: "pointer", fontSize: 11, borderRadius: 3, margin: "0 4px",
              color: currentIndex === -1 ? "#c8a96e" : "#444",
              background: currentIndex === -1 ? "#c8a96e15" : "transparent",
            }}
          >
            Start
          </div>

          {/* Move pairs */}
          {movePairs.map(({ num, white, black }, pairIdx) => (
            <div
              key={white.id}
              style={{ display: "flex", alignItems: "center", padding: "1px 6px", gap: 2 }}
            >
              <span style={{ fontSize: 10, color: "#444", minWidth: 20, textAlign: "right", flexShrink: 0 }}>
                {num}.
              </span>
              {moveChip(pairIdx * 2, white.san)}
              {black && moveChip(pairIdx * 2 + 1, black.san)}
            </div>
          ))}

          {selectedVar && moves.length === 0 && (
            <div style={{ padding: "16px 12px", color: "#333", fontSize: 11 }}>
              Play a move to start recording
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
