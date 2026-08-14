import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    const cleanEmail = String(email ?? "").toLowerCase().trim();
    const pw = String(password ?? "");

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail))
      return NextResponse.json({ error: "Please enter a valid email." }, { status: 400 });
    if (pw.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing)
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });

    const hash = await bcrypt.hash(pw, 12);
    const user = await prisma.user.create({
      data: { email: cleanEmail, password: hash, name: String(name ?? "").trim() || null },
    });

    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (e) {
    console.error("POST /api/register:", e);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
