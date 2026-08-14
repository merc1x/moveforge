import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

// Change password.
export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    const { currentPassword, newPassword } = await req.json();
    const current = String(currentPassword ?? "");
    const next = String(newPassword ?? "");

    if (next.length < 8)
      return NextResponse.json({ error: "New password must be at least 8 characters." }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user)
      return NextResponse.json({ error: "Not found." }, { status: 404 });

    const ok = await bcrypt.compare(current, user.password);
    if (!ok)
      return NextResponse.json({ error: "Current password is incorrect." }, { status: 403 });

    const hash = await bcrypt.hash(next, 12);
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/account:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

// Delete account (repertoires/variations/moves/reviews cascade).
export async function DELETE() {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

    await prisma.user.delete({ where: { id: session.user.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/account:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
