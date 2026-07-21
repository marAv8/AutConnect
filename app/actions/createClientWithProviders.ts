"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Role } from "@prisma/client";

export async function createClientWithProviders(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    throw new Error("Unauthorized");
  }

  const fullName = formData.get("fullName");
  const fullNameValue = typeof fullName === "string" ? fullName.trim() : "";
  const receivesPrescribedMedication =
    formData.get("receivesPrescribedMedication") === "true";

  if (!fullNameValue) {
    throw new Error("Client name required");
  }

  const nameParts = fullNameValue.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");

  if (!lastName) {
    throw new Error("Client last name required");
  }

  const providerIds = formData
    .getAll("providerIds")
    .filter((id): id is string => typeof id === "string");

  await db.$transaction(async (tx) => {
    // 1. Create client
    const client = await tx.client.create({
      data: { firstName, lastName, receivesPrescribedMedication },
    });

    // 2. Auto-assign supervisor (EXACTLY ONE)
    await tx.providerClient.create({
      data: {
        providerId: session.providerId,
        clientId: client.id,
        role: Role.Supervisor,
      },
    });

    // 3. Assign selected providers (excluding supervisor)
    if (providerIds.length > 0) {
      const providers = await tx.provider.findMany({
        where: {
          id: { in: providerIds },
          NOT: { id: session.providerId },
        },
        select: { id: true, role: true },
      });

      await tx.providerClient.createMany({
        data: providers.map((p) => ({
          providerId: p.id,
          clientId: client.id,
          role: p.role as Role,
        })),
      });
    }
  });

  redirect("/dashboard");
}
