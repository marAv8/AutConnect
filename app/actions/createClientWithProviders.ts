"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Role } from "@prisma/client";

function normalizedOrganizationName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function createClientWithProviders(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    throw new Error("Unauthorized");
  }

  const fullName = formData.get("fullName");
  const fullNameValue = typeof fullName === "string" ? fullName.trim() : "";
  const receivesPrescribedMedication =
    formData.get("receivesPrescribedMedication") === "true";
  const agencyName = formData.get("agencyName")?.toString().trim() ?? "";

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
  const selectedProviderIds = new Set(providerIds);
  const agencyProviderIds = new Set(
    formData
      .getAll("agencyProviderIds")
      .filter(
        (id): id is string =>
          typeof id === "string" && selectedProviderIds.has(id)
      )
  );

  if (agencyProviderIds.size > 0 && !agencyName) {
    throw new Error("Add the agency name before identifying its providers.");
  }

  await db.$transaction(async (tx) => {
    const agency = agencyName
      ? await tx.organization.upsert({
          where: {
            normalizedName: normalizedOrganizationName(agencyName),
          },
          create: {
            name: agencyName.replace(/\s+/g, " "),
            normalizedName: normalizedOrganizationName(agencyName),
            type: "AGENCY",
          },
          update: {
            name: agencyName.replace(/\s+/g, " "),
          },
          select: { id: true },
        })
      : null;

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
        organizationId: agency?.id ?? null,
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
          organizationId:
            agency && agencyProviderIds.has(p.id) ? agency.id : null,
        })),
      });
    }

    if (agency) {
      await tx.organizationMembership.upsert({
        where: {
          organizationId_providerId: {
            organizationId: agency.id,
            providerId: session.providerId,
          },
        },
        create: {
          organizationId: agency.id,
          providerId: session.providerId,
          role: "OWNER",
        },
        update: {
          role: "OWNER",
          active: true,
        },
      });

      for (const providerId of agencyProviderIds) {
        await tx.organizationMembership.upsert({
          where: {
            organizationId_providerId: {
              organizationId: agency.id,
              providerId,
            },
          },
          create: {
            organizationId: agency.id,
            providerId,
            role: "MEMBER",
          },
          update: { active: true },
        });
      }
    }
  });

  redirect("/dashboard");
}
