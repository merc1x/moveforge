import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { ownsVariation, ownsMove } from "@/lib/ownership";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const variationId = searchParams.get("variationId");
    if (!variationId)
      return NextResponse.json({ error: "variationId required." }, { status: 400 });
    if (!(await ownsVariation(session.user.id, variationId)))
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    const moves = await prisma.move.findMany({
      where: { variationId },
      orderBy: { order: "asc" },
    });

    return NextResponse.json(moves);
  } catch (e) {
    console.error("GET /api/moves:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id, comment } = await req.json();
    if (!id)
      return NextResponse.json({ error: "id required." }, { status: 400 });
    if (!(await ownsMove(session.user.id, id)))
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    const move = await prisma.move.update({
      where: { id },
      data: { comment: typeof comment === "string" && comment.trim() ? comment.trim() : null },
    });

    return NextResponse.json(move);
  } catch (e) {
    console.error("PATCH /api/moves:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { fen, san, fromSq, toSq, order, variationId } = await req.json();

    if (!fen || !san || !fromSq || !toSq || !order || !variationId)
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    if (!(await ownsVariation(session.user.id, variationId)))
      return NextResponse.json({ error: "Variation not found." }, { status: 404 });

    // Truncate the variation from this order onward, then insert new move
    await prisma.move.deleteMany({ where: { variationId, order: { gte: order } } });

    const move = await prisma.move.create({
      data: { fen, san, fromSq, toSq, order, variationId },
    });

    return NextResponse.json(move, { status: 201 });
  } catch (e) {
    console.error("POST /api/moves:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// Delete a move and every move after it in the same variation (a linear line
// can't keep moves whose preceding position no longer exists). Reviews cascade.
export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id } = await req.json();
    if (!id)
      return NextResponse.json({ error: "id required." }, { status: 400 });
    if (!(await ownsMove(session.user.id, id)))
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    const move = await prisma.move.findFirst({ where: { id } });
    if (!move)
      return NextResponse.json({ error: "Move not found." }, { status: 404 });

    const { count } = await prisma.move.deleteMany({
      where: { variationId: move.variationId, order: { gte: move.order } },
    });
    return NextResponse.json({ ok: true, deleted: count });
  } catch (e) {
    console.error("DELETE /api/moves:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
