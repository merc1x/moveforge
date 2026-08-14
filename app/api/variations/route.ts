import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import { ownsRepertoire, ownsVariation } from "@/lib/ownership";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const repertoireId = searchParams.get("repertoireId");
    if (!repertoireId)
      return NextResponse.json({ error: "repertoireId required." }, { status: 400 });
    if (!(await ownsRepertoire(session.user.id, repertoireId)))
      return NextResponse.json({ error: "Not found." }, { status: 404 });

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
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { name, repertoireId } = await req.json();
    if (!name || !repertoireId)
      return NextResponse.json({ error: "name and repertoireId required." }, { status: 400 });
    if (!(await ownsRepertoire(session.user.id, repertoireId)))
      return NextResponse.json({ error: "Repertoire not found." }, { status: 404 });

    const variation = await prisma.variation.create({ data: { name, repertoireId } });
    return NextResponse.json(variation, { status: 201 });
  } catch (e) {
    console.error("POST /api/variations:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { id, name } = await req.json();
    if (!id || !name?.trim())
      return NextResponse.json({ error: "id and name required." }, { status: 400 });
    if (!(await ownsVariation(session.user.id, id)))
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    const variation = await prisma.variation.update({
      where: { id },
      data: { name: name.trim() },
    });
    return NextResponse.json(variation);
  } catch (e) {
    console.error("PATCH /api/variations:", e);
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
    if (!(await ownsVariation(session.user.id, id)))
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    // Moves and their reviews are removed via onDelete: Cascade.
    await prisma.variation.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/variations:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
