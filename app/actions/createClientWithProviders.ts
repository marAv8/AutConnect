"use server";

import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import {
  getManagedOrganizationIds,
  requireCurrentSupervisor,
} from "@/lib/authorization";

export async function createClientWithProviders(formData: FormData) {
  const supervisor = await requireCurrentSupervisor();

  const fullName = formData.get("fullName");
  const fullNameValue = typeof fullName === "string" ? fullName.trim() : "";
  const receivesPrescribedMedication =
    formData.get("receivesPrescribedMedication") === "true";
  const organizationId = formData.get("organizationId")?.toString().trim() ?? "";

  if (!fullNameValue) {
    throw new Error("Client name required");
  }

  const nameParts = fullNameValue.split(/\s+/);
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");

  if (!lastName) {
    throw new Error("Client last name required");
  }

  const selectedProviderIds = new Set(
    formData
      .getAll("providerIds")
      .filter((id): id is string => typeof id === "string")
  );

  if (!organizationId) {
    throw new Error("Select the responsible organization.");
  }

  const managedOrganizationIds = await getManagedOrganizationIds(supervisor.id);
  if (!managedOrganizationIds.includes(organizationId)) {
    throw new Error("You do not administer that organization.");
  }

  await db.$transaction(async (tx) => {
    const organization = await tx.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) {
      throw new Error("The selected organization is no longer available.");
    }

    const providers = selectedProviderIds.size
      ? await tx.provider.findMany({
          where: {
            id: { in: Array.from(selectedProviderIds) },
            status: "ACTIVE",
            NOT: { id: supervisor.id },
            role: { not: "Supervisor" },
            organizationMemberships: {
              some: { organizationId: organization.id, active: true },
            },
          },
          select: { id: true, role: true },
        })
      : [];

    if (providers.length !== selectedProviderIds.size) {
      throw new Error("Select only active providers from the responsible agency.");
    }

    // 1. Create client
    const client = await tx.client.create({
      data: { firstName, lastName, receivesPrescribedMedication },
      select: { id: true },
    });

    // 2. Auto-assign supervisor (EXACTLY ONE)
    const supervisorAssignment = await tx.providerClient.create({
      data: {
        providerId: supervisor.id,
        clientId: client.id,
        role: Role.Supervisor,
        organizationId: organization.id,
        assignedById: supervisor.id,
      },
      select: { id: true },
    });

    // 3. Establish the additive Client-team foundation for newly created Clients.
    await tx.clientOrganization.create({
      data: {
        clientId: client.id,
        organizationId: organization.id,
        role: "LEAD",
        status: "ACTIVE",
        requestedById: supervisor.id,
        approvedById: supervisor.id,
        activatedAt: new Date(),
      },
    });
    await tx.clientTeamManager.create({
      data: {
        clientId: client.id,
        providerId: supervisor.id,
        grantedById: supervisor.id,
      },
    });

    // 4. Assign selected providers (excluding supervisor)
    if (providers.length > 0) {
      await tx.providerClient.createMany({
        data: providers.map((p) => ({
          providerId: p.id,
          clientId: client.id,
          role: p.role as Role,
          organizationId: organization.id,
          assignedById: supervisor.id,
        })),
      });
    }

    await tx.clientTeamAuditEvent.createMany({
      data: [
        {
          clientId: client.id,
          actorId: supervisor.id,
          action: "ORGANIZATION_REQUESTED",
          organizationId: organization.id,
        },
        {
          clientId: client.id,
          actorId: supervisor.id,
          action: "ORGANIZATION_APPROVED",
          organizationId: organization.id,
        },
        {
          clientId: client.id,
          actorId: supervisor.id,
          action: "TEAM_MANAGER_GRANTED",
          subjectProviderId: supervisor.id,
        },
        {
          clientId: client.id,
          actorId: supervisor.id,
          action: "PROVIDER_ASSIGNED",
          subjectProviderId: supervisor.id,
          organizationId: organization.id,
          assignmentId: supervisorAssignment.id,
        },
        ...providers.map((provider) => ({
          clientId: client.id,
          actorId: supervisor.id,
          action: "PROVIDER_ASSIGNED" as const,
          subjectProviderId: provider.id,
          organizationId: organization.id,
        })),
      ],
    });
  });

  redirect("/dashboard");
}
