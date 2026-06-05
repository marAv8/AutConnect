"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSession } from "@/lib/session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginState = {
  error: string | null;
};

export async function loginProvider(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid email or password format" };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
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
      providerRole: true,
    },
  });

  // APPLICATION IS IN DEVELOPMENT MODE:
  // any syntactically valid email is allowed. No verification or domain check.
  if (!provider) {
    return { error: "Invalid credentials" };
  }

  if (!provider.passwordHash) {
    return { error: "Please use Google OAuth to log in" };
  }

  const isValid = await bcrypt.compare(password, provider.passwordHash);
  if (!isValid) {
    return { error: "Invalid credentials" };
  }

  const sessionRole = provider.role || provider.providerRole;
  if (!sessionRole) {
    return { error: "Your account is not fully configured. Please contact support." };
  }

  await setSession({
    providerId: provider.id,
    role: sessionRole,
  });

  redirect("/dashboard");
}
