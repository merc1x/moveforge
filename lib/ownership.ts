import prisma from "@/lib/prisma";

// Ownership guards — confirm a resource belongs to the given user before any
// read/mutation. Reviews/moves/variations are reached through their parents.

export async function ownsRepertoire(userId: string, repertoireId: string): Promise<boolean> {
  const r = await prisma.repertoire.findFirst({
    where: { id: repertoireId, userId },
    select: { id: true },
  });
  return !!r;
}

export async function ownsVariation(userId: string, variationId: string): Promise<boolean> {
  const v = await prisma.variation.findFirst({
    where: { id: variationId, repertoire: { userId } },
    select: { id: true },
  });
  return !!v;
}

export async function ownsMove(userId: string, moveId: string): Promise<boolean> {
  const m = await prisma.move.findFirst({
    where: { id: moveId, variation: { repertoire: { userId } } },
    select: { id: true },
  });
  return !!m;
}
