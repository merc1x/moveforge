import { Chess, Square } from "chess.js";

export const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;
export type PromotionPiece = (typeof PROMOTION_PIECES)[number];

export const PROMOTION_NAMES: Record<PromotionPiece, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

// True when from→to is a legal pawn promotion in this position, so the caller
// can ask which piece to promote to before actually playing the move.
export function isPromotion(fen: string, from: string, to: string): boolean {
  try {
    const legal = new Chess(fen).moves({ square: from as Square, verbose: true });
    return legal.some((m) => m.to === to && !!m.promotion);
  } catch {
    return false;
  }
}

// Side to move in this position ("w" | "b") — the side doing the promoting.
export function sideToMove(fen: string): "w" | "b" {
  try {
    return new Chess(fen).turn();
  } catch {
    return "w";
  }
}
