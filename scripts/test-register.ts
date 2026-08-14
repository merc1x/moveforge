import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const hash = await bcrypt.hash("test123", 12);
    const user = await prisma.user.create({
      data: { name: "Debug", email: `dbg_${Date.now()}@test.de`, password: hash },
    });
    console.log("OK:", user.email);
  } catch (e) {
    console.error("FEHLER:", e);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
