"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

async function requireSupervisorSession() {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    throw new Error("Unauthorized");
  }
  return session;
}

function normalizedOrganizationName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function removeSupervisorClient(clientId: string) {
  const session = await requireSupervisorSession();

  await db.providerClient.deleteMany({
    where: {
      clientId,
      providerId: session.providerId,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/portal/supervisor/edit-providers");
  return { ok: true };
}

export async function addSupervisorClient(clientId: string) {
  const session = await requireSupervisorSession();

  const existing = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
    },
    select: { id: true },
  });

  if (!existing) {
    await db.providerClient.create({
      data: {
        clientId,
        providerId: session.providerId,
        role: "Supervisor",
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/portal/supervisor/edit-providers");
  return { ok: true };
}

export async function updateClientAssignments(formData: FormData): Promise<void> {
  const session = await requireSupervisorSession();

  const clientId = formData.get("clientId")?.toString();
  const fullNameValue = formData.get("fullName")?.toString().trim() ?? "";
  const receivesPrescribedMedication =
    formData.get("receivesPrescribedMedication") === "true";
  const agencyName = formData.get("agencyName")?.toString().trim() ?? "";
  if (!clientId) {
    throw new Error("Missing client id");
  }
  if (!fullNameValue) {
    throw new Error("Client name required");
  }

  const nameParts = fullNameValue.split(/\s+/).filter(Boolean);
  const firstName = nameParts[0] ?? "";
  const lastName = nameParts.slice(1).join(" ");
  if (!firstName || !lastName) {
    throw new Error("Client first and last name required");
  }

  const canEdit = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
    },
    select: { id: true },
  });

  if (!canEdit) {
    throw new Error("Unauthorized");
  }

  const selectedProviderIds = new Set(
    formData
      .getAll("providerIds")
      .filter((id): id is string => typeof id === "string")
  );
  const agencyProviderIds = new Set(
    formData
      .getAll("agencyProviderIds")
      .filter(
        (id): id is string =>
          typeof id === "string" && selectedProviderIds.has(id)
      )
  );

  if (agencyProviderIds.size > 0 && !agencyName) {
    throw new Error("Add the agency name before identifying its team.");
  }

  await db.$transaction(async (tx) => {
    await tx.client.update({
      where: { id: clientId },
      data: { firstName, lastName, receivesPrescribedMedication },
    });

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

    const existing = await tx.providerClient.findMany({
      where: { clientId },
      select: { id: true, providerId: true, role: true },
    });

    const providersToAttach = await tx.provider.findMany({
      where: {
        id: { in: Array.from(selectedProviderIds) },
      },
      select: { id: true, role: true },
    });

    const existingProviderIds = new Set(existing.map((row) => row.providerId));

    const toDeleteIds = existing
      .filter(
        (row) => row.role !== "Supervisor" && !selectedProviderIds.has(row.providerId)
      )
      .map((row) => row.id);

    if (toDeleteIds.length > 0) {
      await tx.providerClient.deleteMany({
        where: {
          id: { in: toDeleteIds },
        },
      });
    }

    const toCreate = providersToAttach
      .filter((provider) => !existingProviderIds.has(provider.id))
      .map((provider) => ({
        clientId,
        providerId: provider.id,
        role: provider.role as Role,
        organizationId:
          agency && agencyProviderIds.has(provider.id) ? agency.id : null,
      }));

    if (toCreate.length > 0) {
      await tx.providerClient.createMany({
        data: toCreate,
      });
    }

    await tx.providerClient.updateMany({
      where: {
        clientId,
        providerId: session.providerId,
        role: "Supervisor",
      },
      data: { organizationId: agency?.id ?? null },
    });

    for (const providerId of selectedProviderIds) {
      await tx.providerClient.updateMany({
        where: {
          clientId,
          providerId,
        },
        data: {
          organizationId:
            agency && agencyProviderIds.has(providerId) ? agency.id : null,
        },
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

      await tx.caseSupportCase.updateMany({
        where: {
          clientId,
          ownerSupervisorId: session.providerId,
          organizationId: null,
        },
        data: { organizationId: agency.id },
      });

      if (agencyProviderIds.size > 0) {
        await tx.caseSupportRequest.updateMany({
          where: {
            clientId,
            recipientSupervisorId: session.providerId,
            requesterId: { in: Array.from(agencyProviderIds) },
            organizationId: null,
            status: { in: ["REQUESTED", "ACKNOWLEDGED"] },
          },
          data: { organizationId: agency.id },
        });
      }
    }
  });

  revalidatePath("/dashboard");
  revalidatePath("/portal/supervisor/edit-providers");
  revalidatePath(`/portal/supervisor/edit-providers/${clientId}`);
  redirect(`/dashboard?clientId=${clientId}&view=orbit`);
}
