"use server";

import { providerRoleEnum } from "@/app/libs/schemas/provider";
import { db } from "@/lib/db";
import { authOptions } from "@/lib/nextAuth";
import { setSession } from "@/lib/session";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";

const completeProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: providerRoleEnum,
});

export async function completeProfile(formData: FormData): Promise<void> {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.toLowerCase();

  if (!email) {
    redirect("/login");
  }

  const parsed = completeProfileSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    console.error(parsed.error.flatten());
    return;
  }

  const provider = await db.provider.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  if (!provider) {
    redirect("/login");
  }

  const updatedProvider = await db.provider.update({
    where: { id: provider.id },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
    },
    select: {
      id: true,
      role: true,
    },
  });

  await db.$executeRaw`
    UPDATE "Provider"
    SET "providerRole" = ${parsed.data.role}
    WHERE "id" = ${updatedProvider.id}
  `;

  await setSession({
    providerId: updatedProvider.id,
    role: updatedProvider.role,
  });

  redirect("/dashboard");
}
