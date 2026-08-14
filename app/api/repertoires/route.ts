import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });

    const { name, color } = await req.json();
    if (!name || !color)
      return NextResponse.json({ error: "Name und Farbe sind Pflichtfelder." }, { status: 400 });

    const repertoire = await prisma.repertoire.create({
      data: { name, color, userId: session.user.id },
    });

    return NextResponse.json(repertoire, { status: 201 });
  } catch (e) {
    console.error("POST /api/repertoires:", e);
    return NextResponse.json({ error: "Interner Serverfehler." }, { status: 500 });
  }
}
