import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Alle Felder sind Pflichtfelder." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen lang sein." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Diese E-Mail-Adresse ist bereits vergeben." }, { status: 409 });
    }

    const hash = await bcrypt.hash(password, 12);
    await prisma.user.create({ data: { name, email, password: hash } });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Register error:", e);
    return NextResponse.json({ error: "Interner Serverfehler.", detail: msg }, { status: 500 });
  }
}
