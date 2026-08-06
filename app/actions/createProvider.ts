"use server";

import { createProviderSchema } from "@/app/libs/schemas/provider";
import bcrypt from "bcryptjs";
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
    redirect("/create-account?error=invalid");
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
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (existing) {
    redirect("/create-account?error=email-exists");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const provider = await db.provider.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      role,
      providerRole: role,
      authType: "email",
    },
    select: {
      id: true,
      role: true,
    },
  });

  await setSession({
    providerId: provider.id,
    role: provider.role,
  });

  redirect("/dashboard");
}
