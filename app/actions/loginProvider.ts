"use server";

import bcrypt from "bcrypt";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSession } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function loginProvider(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(parsed.error.flatten());
    return;
  }

  const { email, password } = parsed.data;
  const provider = await db.provider.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      passwordHash: true,
      role: true,
    },
  });

  // APPLICATION IS IN DEVELOPMENT MODE:
  // any syntactically valid email is allowed. No verification or domain check.
  if (!provider) {
    console.error("Invalid credentials");
    return;
  }

  if (!provider.passwordHash) {
    console.error("Use OAuth login for this account");
    return;
  }

  const isValid = await bcrypt.compare(password, provider.passwordHash);
  if (!isValid) {
    console.error("Invalid credentials");
    return;
  }

  await setSession({
    providerId: provider.id,
    role: provider.role,
  });

  redirect("/dashboard");
}
