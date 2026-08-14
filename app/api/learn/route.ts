import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { ownsVariation } from "@/lib/ownership";
import { isUserMove, LEVEL_INTERVALS } from "@/lib/srs";

// Mark a variation as learned: every user move that has no review yet enters
// the SRS at level 1 (first review in a few hours). Already-reviewed moves are
// left untouched, so re-learning never resets progress.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { variationId } = await req.json();
    if (!variationId)
      return NextResponse.json({ error: "variationId required." }, { status: 400 });
    if (!(await ownsVariation(session.user.id, variationId)))
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    const variation = await prisma.variation.findFirst({
      where: { id: variationId },
      include: {
        repertoire: { select: { color: true } },
        moves: { include: { review: { select: { id: true } } } },
      },
    });
    if (!variation)
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    const color = variation.repertoire.color;
    const next = new Date(Date.now() + LEVEL_INTERVALS[0]);
    const toLearn = variation.moves.filter(
      (m) => isUserMove(m.order, color) && !m.review
    );

    if (toLearn.length) {
      await prisma.review.createMany({
        data: toLearn.map((m) => ({
          moveId: m.id,
          level: 1,
          nextReview: next,
          lastReview: new Date(),
        })),
      });
    }

    return NextResponse.json({ learned: toLearn.length });
  } catch (e) {
    console.error("POST /api/learn:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
