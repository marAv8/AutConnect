"use server";

import { assignProviderToClientSchema } from "@/app/libs/schemas/providerClient";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

export async function assignProviderToClient(input: unknown) {
  const parsed = assignProviderToClientSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.flatten(),
    };
  }

  const { providerId, clientId, role } = parsed.data;

  try {
    await db.providerClient.create({
      data: {
        providerId,
        clientId,
        role,
      },
    });

    return { ok: true };
  } catch (error: unknown) {
    // Prevent duplicate assignments
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return {
        ok: false,
        errors: {
          assignment: ["Provider is already assigned to this client"],
        },
      };
    }

    throw error;
  }
}
