import { redirect } from "next/navigation";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import RepertoireList from "@/app/components/RepertoireList";

export default async function RepertoirePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const repertoires = await prisma.repertoire.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return <RepertoireList repertoires={repertoires} />;
}
