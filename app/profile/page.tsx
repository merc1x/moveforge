import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { isUserMove } from "@/lib/srs";
import ProfileView, { ProfileData } from "@/app/components/ProfileView";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HEATMAP_WEEKS = 26;

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");

  const repertoires = await prisma.repertoire.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      variations: {
        include: { moves: { select: { order: true, review: { select: { nextReview: true } } } } },
      },
    },
  });

  const now = Date.now();
  let variations = 0, moves = 0, dueNow = 0, dueWeek = 0;
  let nextReviewAt: number | null = null;

  const perRepertoire = repertoires.map((r) => {
    let rMoves = 0, rDueNow = 0;
    variations += r.variations.length;
    for (const v of r.variations) {
      for (const m of v.moves) {
        if (!isUserMove(m.order, r.color)) continue;
        moves++; rMoves++;
        const rev = m.review;
        if (!rev) { dueNow++; rDueNow++; }
        else {
          const t = rev.nextReview.getTime();
          if (t <= now) { dueNow++; rDueNow++; }
          else {
            if (t <= now + WEEK_MS) dueWeek++;
            if (nextReviewAt === null || t < nextReviewAt) nextReviewAt = t;
          }
        }
      }
    }
    return { id: r.id, name: r.name, color: r.color, lines: r.variations.length, moves: rMoves, dueNow: rDueNow };
  });

  // Activity heatmap: count graded reviews per (UTC) day over the last 26 weeks.
  const since = new Date(now - HEATMAP_WEEKS * WEEK_MS);
  const logs = await prisma.reviewLog.findMany({
    where: { userId: user.id, createdAt: { gte: since } },
    select: { createdAt: true },
  });
  const counts: Record<string, number> = {};
  for (const l of logs) {
    const key = l.createdAt.toISOString().slice(0, 10);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const activity = Object.entries(counts).map(([date, count]) => ({ date, count }));

  const data: ProfileData = {
    name: user.name,
    email: user.email,
    memberSince: user.createdAt.toISOString(),
    stats: {
      repertoires: repertoires.length,
      variations,
      moves,
      dueNow,
      dueWeek,
      nextReviewAt,
      totalReviews: logs.length,
    },
    activity,
    perRepertoire,
  };

  return <ProfileView data={data} />;
}
