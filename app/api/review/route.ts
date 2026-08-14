import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { ownsMove } from "@/lib/ownership";
import { nextState } from "@/lib/srs";

// Record one review of a move: promote/demote its level and reschedule it.
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { moveId, correct } = await req.json();

    if (!moveId || typeof correct !== "boolean")
      return NextResponse.json({ error: "moveId and boolean correct required." }, { status: 400 });
    if (!(await ownsMove(session.user.id, moveId)))
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    const move = await prisma.move.findFirst({
      where: { id: moveId },
      include: { review: true },
    });
    if (!move)
      return NextResponse.json({ error: "Move not found." }, { status: 404 });

    const result = nextState(move.review?.level ?? 0, correct);

    const data = { level: result.level, nextReview: result.nextReview, lastReview: new Date() };
    const review = await prisma.review.upsert({
      where: { moveId },
      create: { moveId, ...data },
      update: data,
    });

    // Log the review event for the activity heatmap.
    await prisma.reviewLog.create({ data: { userId: session.user.id } });

    return NextResponse.json({ level: review.level, promoted: result.promoted });
  } catch (e) {
    console.error("POST /api/review:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
