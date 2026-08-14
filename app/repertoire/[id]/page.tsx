import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import RepertoireBoard from "@/app/components/RepertoireBoard";

export default async function RepertoireDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const repertoire = await prisma.repertoire.findFirst({
    where: { id, userId: session.user.id },
    include: { moves: { orderBy: { order: "asc" } } },
  });

  if (!repertoire) notFound();

  return <RepertoireBoard repertoire={repertoire} />;
}
