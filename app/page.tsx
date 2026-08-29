import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Hub from "@/app/components/Hub";

export const dynamic = "force-dynamic";

// Landing page: a hub linking out to each area of the app. The repertoire list
// it used to render directly now lives at /repertoires.
export default async function Home() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const label = session.user.name || session.user.email || "?";
  return <Hub userInitial={label.charAt(0).toUpperCase()} />;
}
