import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const variationId = searchParams.get("variationId");
    if (!variationId)
      return NextResponse.json({ error: "variationId required." }, { status: 400 });

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

export async function POST(req: Request) {
  try {
    const { fen, san, fromSq, toSq, order, variationId } = await req.json();

    if (!fen || !san || !fromSq || !toSq || !order || !variationId)
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });

    const variation = await prisma.variation.findFirst({ where: { id: variationId } });
    if (!variation)
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
