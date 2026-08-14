// Spaced-repetition scheduler — Chessable-style fixed 8-level ladder.
// A correct first-try review promotes a move one level; a miss sends it back to
// level 1. Each level has a fixed interval until the move is due again.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

// Interval until the next review for each level (read as LEVEL_INTERVALS[level-1]).
export const LEVEL_INTERVALS = [
  4 * HOUR,  // L1 · 4 hours
  1 * DAY,   // L2 · 1 day
  3 * DAY,   // L3 · 3 days
  7 * DAY,   // L4 · 1 week
  14 * DAY,  // L5 · 2 weeks
  30 * DAY,  // L6 · 1 month
  90 * DAY,  // L7 · 3 months
  180 * DAY, // L8 · 6 months
];
export const MAX_LEVEL = LEVEL_INTERVALS.length; // 8

export type SrsResult = { level: number; nextReview: Date; promoted: boolean };

// Advance a move's level after one review. `correct` = recalled on the first
// try (no wrong attempts, no peeking at the answer).
export function nextState(currentLevel: number, correct: boolean, now: Date = new Date()): SrsResult {
  const prev = currentLevel || 0;
  const level = correct ? Math.min(prev + 1, MAX_LEVEL) : 1;
  const nextReview = new Date(now.getTime() + LEVEL_INTERVALS[level - 1]);
  return { level, nextReview, promoted: correct && level > prev };
}

// Short human label for a level's interval (for the UI).
export function levelLabel(level: number): string {
  return ["—", "4h", "1d", "3d", "1w", "2w", "1mo", "3mo", "6mo"][level] ?? "";
}

// A move is a review card only when it's the user's own move (their colour to
// play). order is 1-indexed: white moves are odd, black moves are even.
export function isUserMove(order: number, color: string): boolean {
  return (color === "white") === (order % 2 === 1);
}
