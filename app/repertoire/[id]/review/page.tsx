import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import { isUserMove, REVIEW_LINES_PER_SESSION } from "@/lib/sm2";
import ReviewSession, { ReviewLine } from "@/app/components/ReviewSession";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const repertoire = await prisma.repertoire.findFirst({
    where: { id },
    include: {
      variations: {
        include: { moves: { orderBy: { order: "asc" }, include: { review: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!repertoire) notFound();

  const now = new Date();

  // A line (variation) is due when any of the user's own moves in it is due —
  // a new move never reviewed, or a scheduled review whose time has come.
  type Candidate = { line: ReviewLine; sortKey: number };
  const candidates: Candidate[] = [];

  for (const variation of repertoire.variations) {
    if (variation.moves.length === 0) continue;

    let due = false;
    let earliest = Infinity; // earliest scheduled-due time; new-only lines stay Infinity

    for (const m of variation.moves) {
      if (!isUserMove(m.order, repertoire.color)) continue;
      if (!m.review) {
        due = true; // never seen → due
      } else if (m.review.nextReview <= now) {
        due = true;
        earliest = Math.min(earliest, m.review.nextReview.getTime());
      }
    }

    if (!due) continue;

    candidates.push({
      sortKey: earliest,
      line: {
        variationId: variation.id,
        variationName: variation.name,
        moves: variation.moves.map((m) => ({
          moveId: m.id,
          san: m.san,
          fromSq: m.fromSq,
          toSq: m.toSq,
          fen: m.fen,
          comment: m.comment ?? null,
          isUserMove: isUserMove(m.order, repertoire.color),
        })),
      },
    });
  }

  // Overdue scheduled lines first (earliest due), then brand-new lines.
  candidates.sort((a, b) => a.sortKey - b.sortKey);
  const lines = candidates.slice(0, REVIEW_LINES_PER_SESSION).map((c) => c.line);

  return (
    <ReviewSession
      repertoireId={repertoire.id}
      repertoireName={repertoire.name}
      color={repertoire.color}
      lines={lines}
    />
  );
}
