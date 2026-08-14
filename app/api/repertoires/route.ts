import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { ownsRepertoire } from "@/lib/ownership";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { name, color } = await req.json();
    if (!name || !color)
      return NextResponse.json({ error: "Name and color are required." }, { status: 400 });

    const repertoire = await prisma.repertoire.create({
      data: { name, color, userId: session.user.id },
    });

    return NextResponse.json(repertoire, { status: 201 });
  } catch (e) {
    console.error("POST /api/repertoires:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id } = await req.json();
    if (!id)
      return NextResponse.json({ error: "id required." }, { status: 400 });
    if (!(await ownsRepertoire(session.user.id, id)))
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    // Variations, moves and reviews are removed via onDelete: Cascade.
    await prisma.repertoire.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/repertoires:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
