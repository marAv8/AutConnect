import { authOptions } from "@/lib/nextAuth";
import { setSession } from "@/lib/session";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

export default async function OAuthCompletePage() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    redirect("/login");
  }

  const provider = await db.provider.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      role: true,
    },
  });

  if (!provider) {
    redirect("/login");
  }

  if (!provider.role) {
    redirect("/complete-profile");
  }

  await setSession({
    providerId: provider.id,
    role: provider.role,
  });

  redirect("/dashboard");
}
