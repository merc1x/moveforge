// Helpers for turning raw UCI engine output into something displayable:
// White-relative scores, formatted evaluations, and SAN principal variations.

import { Chess } from "chess.js";

// An engine score is either a centipawn value or a forced mate in N moves —
// never both. Both are stored White-relative once normalized.
export type Score = { cp: number | null; mate: number | null };

// Stockfish reports scores from the side-to-move's perspective; the UI always
// reads them from White's, so flip the sign when Black is to move.
export function toWhitePerspective(score: Score, turn: "w" | "b"): Score {
  if (turn === "w") return score;
  return {
    cp: score.cp === null ? null : -score.cp,
    mate: score.mate === null ? null : -score.mate,
  };
}

// "+1.24", "-0.35", "M4" / "-M4" for a forced mate, "0.00" at dead level.
export function formatScore(score: Score): string {
  if (score.mate !== null) {
    return score.mate >= 0 ? `M${score.mate}` : `-M${Math.abs(score.mate)}`;
  }
  if (score.cp === null) return "—";
  const pawns = score.cp / 100;
  return `${pawns > 0 ? "+" : pawns < 0 ? "−" : ""}${Math.abs(pawns).toFixed(2)}`;
}

// Share of the bar that belongs to White, 0…1. Centipawns are squashed through
// a logistic curve so the bar keeps moving in the ±1 pawn range that matters in
// an opening repertoire instead of pinning at ±3. Non-mate scores are clamped
// so the losing side always keeps a visible sliver.
export function whiteBarFraction(score: Score): number {
  if (score.mate !== null) return score.mate >= 0 ? 1 : 0;
  if (score.cp === null) return 0.5;
  const raw = 1 / (1 + Math.exp(-score.cp / 320));
  return Math.min(0.97, Math.max(0.03, raw));
}

export type PvMove = { san: string; moveNumber: number; color: "w" | "b" };

// Replay a UCI principal variation ("e2e4 e7e5 g1f3") from `fen` to get SAN.
// Stops at the first move the position rejects — a truncated line is better
// than throwing while the engine is mid-search and the PV is still in flux.
export function uciLineToSan(fen: string, uci: string[]): PvMove[] {
  let game: Chess;
  try {
    game = new Chess(fen);
  } catch {
    return [];
  }
  const out: PvMove[] = [];
  for (const move of uci) {
    const moveNumber = game.moveNumber();
    let played;
    try {
      played = game.move({
        from: move.slice(0, 2),
        to: move.slice(2, 4),
        promotion: move.slice(4, 5) || undefined,
      });
    } catch {
      break;
    }
    if (!played) break;
    out.push({ san: played.san, moveNumber, color: played.color });
  }
  return out;
}
