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

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
  const providers = await db.provider.findMany({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
      passwordHash: {
        not: null,
      },
      NOT: {
        passwordHash: "",
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
  if (providers.length === 0) {
    console.error("Use OAuth login for this account");
    return;
  }

  let provider = null;
  for (const candidate of providers) {
    if (!candidate.passwordHash) {
      continue;
    }

    const isValid = await bcrypt.compare(password, candidate.passwordHash);
    if (isValid) {
      provider = candidate;
      break;
    }
  }

  if (!provider) {
    console.error("Invalid credentials");
    return;
  }

  const sessionRole = provider.role || provider.providerRole;
  if (!sessionRole) {
    console.error("Provider role is missing");
    return;
  }

  await setSession({
    providerId: provider.id,
    role: sessionRole,
  });

  redirect("/dashboard");
}
