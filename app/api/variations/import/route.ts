import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

type ImportMove = {
  fen: string;
  san: string;
  fromSq: string;
  toSq: string;
  order: number;
  comment?: string;
};

type ImportGame = {
  name: string;
  moves: ImportMove[];
};

export async function POST(req: Request) {
  try {
    const { repertoireId, games } = (await req.json()) as {
      repertoireId: string;
      games: ImportGame[];
    };

    if (!repertoireId || !Array.isArray(games) || games.length === 0)
      return NextResponse.json({ error: "repertoireId and games required." }, { status: 400 });

    const repertoire = await prisma.repertoire.findFirst({ where: { id: repertoireId } });
    if (!repertoire)
      return NextResponse.json({ error: "Repertoire not found." }, { status: 404 });

    for (const g of games) {
      if (!g.name || !Array.isArray(g.moves) || g.moves.length === 0)
        return NextResponse.json({ error: "Each game needs a name and at least one move." }, { status: 400 });
      for (const m of g.moves) {
        if (!m.fen || !m.san || !m.fromSq || !m.toSq || !m.order)
          return NextResponse.json({ error: "Each move needs fen, san, fromSq, toSq and order." }, { status: 400 });
      }
    }

    const variationIds = await prisma.$transaction(async (tx) => {
      const ids: string[] = [];
      for (const g of games) {
        const variation = await tx.variation.create({
          data: { name: g.name, repertoireId },
        });
        await tx.move.createMany({
          data: g.moves.map((m) => ({
            fen: m.fen,
            san: m.san,
            fromSq: m.fromSq,
            toSq: m.toSq,
            order: m.order,
            comment: typeof m.comment === "string" && m.comment ? m.comment : null,
            variationId: variation.id,
          })),
        });
        ids.push(variation.id);
      }
      return ids;
    });

    const created = await prisma.variation.findMany({
      where: { id: { in: variationIds } },
      include: { moves: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    console.error("POST /api/variations/import:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
