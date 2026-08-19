"use client";

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { PROMOTION_PIECES, PROMOTION_NAMES, type PromotionPiece } from "@/lib/chess";

// Draw the picker with the board's own piece SVGs so a promotion choice looks
// exactly like the piece you get. Loaded the same client-only way as the board.
const PieceIcon = dynamic(
  () =>
    import("react-chessboard").then((m) => {
      return function PieceIcon({ piece }: { piece: string }) {
        const Render = m.defaultPieces[piece];
        return Render ? <Render /> : null;
      };
    }),
  { ssr: false }
);

// Overlay for choosing a promotion piece. Renders as a column of four pieces
// dropping from the promotion square toward the middle of the board, so it must
// be placed inside a position:relative wrapper that matches the board's box.
export default function PromotionPicker({
  square,
  color,
  orientation,
  onSelect,
  onCancel,
}: {
  square: string;          // target square, e.g. "e8"
  color: "w" | "b";        // side that is promoting
  orientation: "white" | "black";
  onSelect: (piece: PromotionPiece) => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "Escape") { e.preventDefault(); onCancel(); return; }
      const piece = e.key.toLowerCase() as PromotionPiece;
      if ((PROMOTION_PIECES as readonly string[]).includes(piece)) {
        e.preventDefault();
        onSelect(piece);
      }
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [onSelect, onCancel]);

  const file = square.charCodeAt(0) - 97;      // a..h → 0..7
  const rank = Number(square[1]);              // 1..8
  const col = orientation === "black" ? 7 - file : file;
  const row = orientation === "black" ? rank - 1 : 8 - rank;
  const downward = row === 0;                  // cascade away from the board edge

  return (
    <div
      onClick={onCancel}
      onContextMenu={(e) => { e.preventDefault(); onCancel(); }}
      style={{ position: "absolute", inset: 0, background: "#00000099", zIndex: 20 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute",
          left: `${col * 12.5}%`,
          top: downward ? 0 : "50%",
          width: "12.5%",
          height: "50%",
          display: "flex",
          flexDirection: downward ? "column" : "column-reverse",
          background: "#f1e7d5",
          boxShadow: "0 3px 18px #00000066",
        }}
      >
        {PROMOTION_PIECES.map((p) => (
          <button
            key={p}
            title={PROMOTION_NAMES[p]}
            onClick={() => onSelect(p)}
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", border: "none", cursor: "pointer", padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#c8a96e66"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
          >
            <span style={{ width: "82%", aspectRatio: "1", display: "block" }}>
              <PieceIcon piece={`${color}${p.toUpperCase()}`} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
