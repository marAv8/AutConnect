"use server";

import { providerRoleEnum } from "@/app/libs/schemas/provider";
import { db } from "@/lib/db";
import { getSession, setSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { z } from "zod";

const completeProfileSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  role: providerRoleEnum,
});

export async function completeProfile(formData: FormData): Promise<void> {
  const session = await getSession();

  if (!session) {
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

  const updatedProvider = await db.provider.update({
    where: { id: session.providerId },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
      providerRole: parsed.data.role,
    },
    select: {
      id: true,
      role: true,
    },
  });

  await setSession({
    providerId: updatedProvider.id,
    role: updatedProvider.role,
  });

  redirect("/dashboard");
}
