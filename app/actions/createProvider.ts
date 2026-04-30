"use server";

import { createProviderSchema } from "@/app/libs/schemas/provider";
import bcrypt from "bcrypt";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { setSession } from "@/lib/session";

export async function createProvider(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    role: formData.get("role"),
  };

  const parsed = createProviderSchema.safeParse(raw);

  if (!parsed.success) {
    console.error(parsed.error.flatten());
    return;
  }

  const { password, firstName, lastName, role } = parsed.data;
  const email = parsed.data.email.toLowerCase();

  const existing = await db.provider.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: { id: true },
  });

  // ✅ THIS IS THE CRITICAL FIX
  if (existing) {
    redirect("/create-account?error=email-exists");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const provider = await db.provider.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
    },
  });

  await db.$executeRaw`
    UPDATE "Provider"
    SET "providerRole" = ${role}, "authType" = 'email'
    WHERE "id" = ${provider.id}
  `;

  await setSession({
    providerId: provider.id,
    role: provider.role,
  });

  redirect("/dashboard");
}
