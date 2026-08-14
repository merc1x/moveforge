import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { isUserMove } from "@/lib/srs";
import ReviewSession, { ReviewLine } from "@/app/components/ReviewSession";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const repertoire = await prisma.repertoire.findFirst({
    where: { id, userId: session.user.id },
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

    // A line is reviewable only once it has been learned — every user move must
    // already be in the SRS. Then it's due if any of those reviews has come up.
    let learned = true;
    let due = false;
    let earliest = Infinity;

    for (const m of variation.moves) {
      if (!isUserMove(m.order, repertoire.color)) continue;
      if (!m.review) { learned = false; break; }
      if (m.review.nextReview <= now) {
        due = true;
        earliest = Math.min(earliest, m.review.nextReview.getTime());
      }
    }

    if (!learned || !due) continue;

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
          level: m.review?.level ?? 0,
        })),
      },
    });
  }

  // Overdue scheduled lines first (earliest due), then brand-new lines.
  // All due lines are shown; you can exit any time — each move is saved as you go.
  candidates.sort((a, b) => a.sortKey - b.sortKey);
  const lines = candidates.map((c) => c.line);

  return (
    <ReviewSession
      repertoireId={repertoire.id}
      repertoireName={repertoire.name}
      color={repertoire.color}
      lines={lines}
    />
  );
}
