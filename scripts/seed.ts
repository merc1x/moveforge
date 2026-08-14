import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: "postgresql://postgres:sml12345@localhost:5432/chessable" });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hash = await bcrypt.hash("passwort123", 12);

  await prisma.user.upsert({
    where: { email: "test@test.de" },
    update: {},
    create: { email: "test@test.de", name: "Test User", password: hash },
  });

  console.log("✓ User erstellt: test@test.de / passwort123");
  await prisma.$disconnect();
}

main();
