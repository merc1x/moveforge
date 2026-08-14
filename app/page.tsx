import prisma from "@/lib/prisma";
import RepertoireList from "@/app/components/RepertoireList";

export default async function Home() {
  const repertoires = await prisma.repertoire.findMany({
    orderBy: { createdAt: "desc" },
  });

  return <RepertoireList repertoires={repertoires} />;
}
