import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { isUserMove } from "@/lib/srs";
import RepertoireList from "@/app/components/RepertoireList";

export const dynamic = "force-dynamic";

export default async function RepertoiresPage() {
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

  // Per repertoire: how many variations still need learning, and how many
  // already-learned ones are due for review.
  const withCounts = repertoires.map((r) => {
    let learnCount = 0;
    let dueCount = 0;
    for (const v of r.variations) {
      const userMoves = v.moves.filter((m) => isUserMove(m.order, r.color));
      if (userMoves.length === 0) continue;
      const learned = userMoves.every((m) => !!m.review);
      if (!learned) {
        learnCount++;
      } else if (userMoves.some((m) => m.review!.nextReview <= now)) {
        dueCount++;
      }
    }
    return { id: r.id, name: r.name, color: r.color, createdAt: r.createdAt, learnCount, dueCount };
  });

  const label = session.user.name || session.user.email || "?";
  return <RepertoireList repertoires={withCounts} userInitial={label.charAt(0).toUpperCase()} />;
}
