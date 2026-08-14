import prisma from "@/lib/prisma";
import { isUserMove, REVIEW_LINES_PER_SESSION } from "@/lib/sm2";
import RepertoireList from "@/app/components/RepertoireList";

export default async function Home() {
  const repertoires = await prisma.repertoire.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      variations: {
        include: { moves: { select: { order: true, review: { select: { nextReview: true } } } } },
      },
    },
  });

  const now = new Date();

  // Count lines (variations) due now — matching what a review session plays.
  // A line is due when any of the user's moves in it is new or past its review.
  const withCounts = repertoires.map((r) => {
    let dueLines = 0;
    for (const v of r.variations) {
      if (v.moves.length === 0) continue;
      const due = v.moves.some(
        (m) => isUserMove(m.order, r.color) && (!m.review || m.review.nextReview <= now)
      );
      if (due) dueLines++;
    }
    const dueCount = Math.min(dueLines, REVIEW_LINES_PER_SESSION);
    return { id: r.id, name: r.name, color: r.color, createdAt: r.createdAt, dueCount };
  });

  return <RepertoireList repertoires={withCounts} />;
}
