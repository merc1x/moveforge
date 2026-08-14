// SM-2 (SuperMemo 2) spaced-repetition scheduler — Woźniak, 1987.
// Used by Anki and Chessable (in modified forms). Given the prior scheduling
// state of a card and a recall quality q (0–5), it returns the next state:
// how easy the card is (ease), how many days until it is due (interval), how
// many successful reps in a row (repetitions) and the resulting nextReview date.

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Cap how many lines (variations) enter a single review session, so a fresh
// import doesn't dump dozens of lines at once. A line is reviewed whole, from
// move 1, whenever any of its moves is due.
export const REVIEW_LINES_PER_SESSION = 15;

// A move is a review card only when it's the user's own move (their colour to
// play). order is 1-indexed: white moves are odd, black moves are even.
export function isUserMove(order: number, color: string): boolean {
  return (color === "white") === (order % 2 === 1);
}

export type Sm2State = {
  ease: number;
  interval: number;
  repetitions: number;
};

export type Sm2Result = Sm2State & {
  nextReview: Date;
  lapsed: boolean;
};

export const INITIAL_SM2: Sm2State = { ease: 2.5, interval: 0, repetitions: 0 };

/**
 * Advance a card's scheduling state by one review.
 *
 * @param state current { ease, interval, repetitions }
 * @param quality recall grade 0–5 (>= 3 counts as a successful recall)
 * @param now reference time (injectable for testing)
 */
export function sm2(state: Sm2State, quality: number, now: Date = new Date()): Sm2Result {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  let { ease, interval, repetitions } = state;
  let lapsed = false;

  if (q < 3) {
    // Failed recall: relearn from scratch, but keep a (reduced) ease factor.
    repetitions = 0;
    interval = 1;
    lapsed = true;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * ease);
    repetitions += 1;
  }

  // Ease adjustment is applied on every review (including lapses).
  ease = ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
  if (ease < 1.3) ease = 1.3;

  const nextReview = new Date(now.getTime() + interval * MS_PER_DAY);
  return { ease, interval, repetitions, nextReview, lapsed };
}

// Auto-grade a board-input review from the number of wrong attempts before the
// correct move was played. Recall on the board is binary (you eventually find
// the move), so attempts stand in for the 0–5 self-rating Anki asks for.
export function gradeFromAttempts(wrongAttempts: number): number {
  if (wrongAttempts <= 0) return 5; // instant, confident recall
  if (wrongAttempts === 1) return 3; // recalled, but shaky
  return 1; // multiple misses → lapse, reset the interval
}
