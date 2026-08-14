import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const repertoireId = searchParams.get("repertoireId");
    if (!repertoireId)
      return NextResponse.json({ error: "repertoireId required." }, { status: 400 });

    const variations = await prisma.variation.findMany({
      where: { repertoireId },
      include: { moves: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(variations);
  } catch (e) {
    console.error("GET /api/variations:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, repertoireId } = await req.json();
    if (!name || !repertoireId)
      return NextResponse.json({ error: "name and repertoireId required." }, { status: 400 });

    const repertoire = await prisma.repertoire.findFirst({ where: { id: repertoireId } });
    if (!repertoire)
      return NextResponse.json({ error: "Repertoire not found." }, { status: 404 });

    const variation = await prisma.variation.create({ data: { name, repertoireId } });
    return NextResponse.json(variation, { status: 201 });
  } catch (e) {
    console.error("POST /api/variations:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
