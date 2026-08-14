import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { ownsVariation } from "@/lib/ownership";

// Log one heatmap entry per reviewed line (variation) — counts variations, not
// individual moves. Called when a line is completed in a review session.
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

    await prisma.reviewLog.create({ data: { userId: session.user.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/review/line:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
