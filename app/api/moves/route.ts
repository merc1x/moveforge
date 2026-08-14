import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

    const { fen, san, fromSq, toSq, order, repertoireId, parentMoveId } = await req.json();

    // Sicherstellen dass das Repertoire dem User gehört
    const repertoire = await prisma.repertoire.findFirst({
      where: { id: repertoireId, userId: session.user.id },
    });
    if (!repertoire)
      return NextResponse.json({ error: "Repertoire nicht gefunden." }, { status: 404 });

    // Zug existiert schon? (selber Parent + selbes SAN)
    const existing = await prisma.move.findFirst({
      where: { repertoireId, parentMoveId: parentMoveId ?? null, san },
    });
    if (existing) return NextResponse.json(existing, { status: 200 });

    const move = await prisma.move.create({
      data: { fen, san, fromSq, toSq, order, repertoireId, parentMoveId: parentMoveId ?? null },
    });

    return NextResponse.json(move, { status: 201 });
  } catch (e) {
    console.error("POST /api/moves:", e);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
