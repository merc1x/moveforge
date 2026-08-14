import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sm2 } from "@/lib/sm2";

// Record one review of a move and advance its SM-2 schedule.
export async function POST(req: Request) {
  try {
    const { moveId, quality } = await req.json();

    if (!moveId || typeof quality !== "number")
      return NextResponse.json({ error: "moveId and numeric quality required." }, { status: 400 });

    const move = await prisma.move.findFirst({
      where: { id: moveId },
      include: { review: true },
    });
    if (!move)
      return NextResponse.json({ error: "Move not found." }, { status: 404 });

    const prev = move.review ?? { ease: 2.5, interval: 0, repetitions: 0 };
    const next = sm2(
      { ease: prev.ease, interval: prev.interval, repetitions: prev.repetitions },
      quality
    );

    const data = {
      ease: next.ease,
      interval: next.interval,
      repetitions: next.repetitions,
      nextReview: next.nextReview,
      lastReview: new Date(),
      lapses: (move.review?.lapses ?? 0) + (next.lapsed ? 1 : 0),
    };

    const review = await prisma.review.upsert({
      where: { moveId },
      create: { moveId, ...data },
      update: data,
    });

    return NextResponse.json(review);
  } catch (e) {
    console.error("POST /api/review:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
