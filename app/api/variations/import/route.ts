import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { ownsRepertoire } from "@/lib/ownership";

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
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { repertoireId, games } = (await req.json()) as {
      repertoireId: string;
      games: ImportGame[];
    };

    if (!repertoireId || !Array.isArray(games) || games.length === 0)
      return NextResponse.json({ error: "repertoireId and games required." }, { status: 400 });

    if (!(await ownsRepertoire(session.user.id, repertoireId)))
      return NextResponse.json({ error: "Repertoire not found." }, { status: 404 });

    for (const g of games) {
      if (!g.name || !Array.isArray(g.moves) || g.moves.length === 0)
        return NextResponse.json({ error: "Each game needs a name and at least one move." }, { status: 400 });
      for (const m of g.moves) {
        if (!m.fen || !m.san || !m.fromSq || !m.toSq || !m.order)
          return NextResponse.json({ error: "Each move needs fen, san, fromSq, toSq and order." }, { status: 400 });
      }
    }

    // Two bulk inserts instead of two queries per game: a big PGN would otherwise
    // outlive the interactive-transaction timeout. Ids and createdAt are set here so
    // moves can reference their variation and the import order is preserved.
    const base = Date.now();
    const variations = games.map((g, i) => ({
      id: randomUUID(),
      name: g.name,
      repertoireId,
      createdAt: new Date(base + i),
    }));
    const variationIds = variations.map((v) => v.id);

    await prisma.$transaction([
      prisma.variation.createMany({ data: variations }),
      prisma.move.createMany({
        data: games.flatMap((g, i) =>
          g.moves.map((m) => ({
            fen: m.fen,
            san: m.san,
            fromSq: m.fromSq,
            toSq: m.toSq,
            order: m.order,
            comment: typeof m.comment === "string" && m.comment ? m.comment : null,
            variationId: variations[i].id,
          })),
        ),
      }),
    ]);

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
