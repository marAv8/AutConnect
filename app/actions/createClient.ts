"use server";

import { createClientSchema } from "@/app/libs/schemas/client";
import { db } from "@/lib/db";

export async function createClient(input: unknown) {
  const parsed = createClientSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
    };
  }

  const { firstName, lastName, dateOfBirth, diagnosis } = parsed.data;

  await db.client.create({
    data: {
      firstName,
      lastName,
      dateOfBirth: dateOfBirth ?? null,
      diagnosis: diagnosis ?? null,
    },
  });

  return { ok: true };
}
