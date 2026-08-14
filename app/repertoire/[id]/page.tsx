import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import RepertoireEditor from "@/app/components/RepertoireEditor";

export default async function RepertoireDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const repertoire = await prisma.repertoire.findFirst({
    where: { id },
    include: {
      variations: {
        include: { moves: { orderBy: { order: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!repertoire) notFound();

  return <RepertoireEditor repertoire={repertoire} />;
}
