import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { isUserMove } from "@/lib/srs";
import RepertoireList from "@/app/components/RepertoireList";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const repertoires = await prisma.repertoire.findMany({
    where: { userId: session.user.id },
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
    let dueCount = 0;
    for (const v of r.variations) {
      if (v.moves.length === 0) continue;
      const due = v.moves.some(
        (m) => isUserMove(m.order, r.color) && (!m.review || m.review.nextReview <= now)
      );
      if (due) dueCount++;
    }
    return { id: r.id, name: r.name, color: r.color, createdAt: r.createdAt, dueCount };
  });

  const label = session.user.name || session.user.email || "?";
  return <RepertoireList repertoires={withCounts} userInitial={label.charAt(0).toUpperCase()} />;
}
