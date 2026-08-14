import { notFound, redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";
import RepertoireEditor from "@/app/components/RepertoireEditor";

export const dynamic = "force-dynamic";

export default async function RepertoireDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const repertoire = await prisma.repertoire.findFirst({
    where: { id, userId: session.user.id },
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
