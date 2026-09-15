"use server";

import type { Prisma, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireCurrentProvider } from "@/lib/authorization";
import {
  activeClientAssignmentWhere,
  activeClientOrganizationWhere,
  activeClientTeamManagerWhere,
  boundedClientTeamAuditMetadata,
  eligibleProviderWhere,
  eligibleProvidersInOrganizationWhere,
  isEligibleClientAssignmentRole,
} from "@/lib/clientTeamAuthorizationPolicy";
import {
  normalizeOrganizationSearchQuery,
  ORGANIZATION_SEARCH_MIN_LENGTH,
} from "@/lib/clientTeamOrganizationSearch";

const ORGANIZATION_RESULT_LIMIT = 12;
const PROVIDER_RESULT_LIMIT = 50;

type Transaction = Prisma.TransactionClient;

function requiredId(formData: FormData, name: string) {
  const value = formData.get(name);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Invalid client-team request.");
  }
  return value.trim();
}

async function requireTeamManager(
  tx: Transaction,
  actorId: string,
  clientId: string
) {
  const [assignment, manager] = await Promise.all([
    tx.providerClient.findFirst({
      where: activeClientAssignmentWhere(actorId, clientId),
      select: { id: true },
    }),
    tx.clientTeamManager.findFirst({
      where: activeClientTeamManagerWhere(actorId, clientId),
      select: { id: true },
    }),
  ]);
  if (!assignment || !manager) throw new Error("Unauthorized");
}

function refreshClientTeam(clientId: string) {
  revalidatePath(`/portal/supervisor/edit-providers/${clientId}`);
  revalidatePath("/portal/organization/client-invitations");
  revalidatePath("/dashboard");
}

export async function searchOrganizationsForClient(
  clientId: string,
  query: string
) {
  const actor = await requireCurrentProvider();
  const normalizedQuery = normalizeOrganizationSearchQuery(query);
  if (normalizedQuery.length < ORGANIZATION_SEARCH_MIN_LENGTH) return [];

  return db.$transaction(async (tx) => {
    await requireTeamManager(tx, actor.id, clientId);
    return tx.organization.findMany({
      where: {
        name: { contains: normalizedQuery, mode: "insensitive" },
        clientOrganizations: {
          none: {
            clientId,
            OR: [
              { status: { not: "REVOKED" } },
              { revokedAt: null },
            ],
          },
        },
      },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: ORGANIZATION_RESULT_LIMIT,
      select: { id: true, name: true, type: true },
    });
  });
}

export async function inviteClientOrganization(formData: FormData) {
  const actor = await requireCurrentProvider();
  const clientId = requiredId(formData, "clientId");
  const organizationId = requiredId(formData, "organizationId");

  await db.$transaction(
    async (tx) => {
      await requireTeamManager(tx, actor.id, clientId);
      const [organization, lead, existing] = await Promise.all([
        tx.organization.findUnique({
          where: { id: organizationId },
          select: { id: true },
        }),
        tx.clientOrganization.findFirst({
          where: {
            clientId,
            role: "LEAD",
            status: "ACTIVE",
            revokedAt: null,
          },
          select: { organizationId: true },
        }),
        tx.clientOrganization.findUnique({
          where: { clientId_organizationId: { clientId, organizationId } },
          select: { id: true, status: true, revokedAt: true, revocationReason: true },
        }),
      ]);
      if (!organization || !lead || lead.organizationId === organizationId) {
        throw new Error("That organization cannot be invited.");
      }
      if (
        existing &&
        existing.revokedAt === null &&
        (existing.status === "PENDING" || existing.status === "ACTIVE")
      ) {
        throw new Error("That organization already participates or has an invitation.");
      }

      if (existing) {
        const updated = await tx.clientOrganization.updateMany({
          where: { id: existing.id, status: "REVOKED", revokedAt: { not: null } },
          data: {
            role: "PARTICIPATING",
            status: "PENDING",
            requestedById: actor.id,
            requestedAt: new Date(),
            approvedById: null,
            activatedAt: null,
            revokedAt: null,
            revokedById: null,
            revocationReason: null,
          },
        });
        if (updated.count !== 1) throw new Error("The invitation changed. Try again.");
      } else {
        await tx.clientOrganization.create({
          data: {
            clientId,
            organizationId,
            role: "PARTICIPATING",
            status: "PENDING",
            requestedById: actor.id,
          },
        });
      }

      await tx.clientTeamAuditEvent.create({
        data: {
          clientId,
          actorId: actor.id,
          action: "ORGANIZATION_REQUESTED",
          organizationId,
          metadata: boundedClientTeamAuditMetadata({
            transition: existing ? "REINVITED" : "INVITED",
            priorDisposition: existing?.revocationReason ?? null,
          }),
        },
      });
    },
    { isolationLevel: "Serializable" }
  );
  refreshClientTeam(clientId);
}

async function decideClientOrganization(
  relationshipId: string,
  decision: "APPROVE" | "REJECT"
) {
  const actor = await requireCurrentProvider();
  let clientId = "";
  await db.$transaction(
    async (tx) => {
      const relationship = await tx.clientOrganization.findUnique({
        where: { id: relationshipId },
        select: {
          id: true,
          clientId: true,
          organizationId: true,
          role: true,
          status: true,
          revokedAt: true,
        },
      });
      if (
        !relationship ||
        relationship.role !== "PARTICIPATING" ||
        relationship.status !== "PENDING" ||
        relationship.revokedAt !== null
      ) {
        throw new Error("That invitation is no longer pending.");
      }
      clientId = relationship.clientId;
      const membership = await tx.organizationMembership.findFirst({
        where: {
          organizationId: relationship.organizationId,
          providerId: actor.id,
          active: true,
          role: { in: ["OWNER", "ADMIN"] },
        },
        select: { id: true },
      });
      if (!membership) throw new Error("Unauthorized");

      const now = new Date();
      const updated = await tx.clientOrganization.updateMany({
        where: { id: relationship.id, status: "PENDING", revokedAt: null },
        data:
          decision === "APPROVE"
            ? {
                status: "ACTIVE",
                approvedById: actor.id,
                activatedAt: now,
              }
            : {
                status: "REVOKED",
                revokedAt: now,
                revokedById: actor.id,
                revocationReason: "REJECTED_BY_ORGANIZATION",
              },
      });
      if (updated.count !== 1) throw new Error("That invitation changed. Try again.");
      await tx.clientTeamAuditEvent.create({
        data: {
          clientId,
          actorId: actor.id,
          action:
            decision === "APPROVE"
              ? "ORGANIZATION_APPROVED"
              : "ORGANIZATION_REVOKED",
          organizationId: relationship.organizationId,
          metadata: boundedClientTeamAuditMetadata({ transition: decision }),
        },
      });
    },
    { isolationLevel: "Serializable" }
  );
  refreshClientTeam(clientId);
}

export async function approveClientOrganization(formData: FormData) {
  return decideClientOrganization(requiredId(formData, "relationshipId"), "APPROVE");
}

export async function rejectClientOrganization(formData: FormData) {
  return decideClientOrganization(requiredId(formData, "relationshipId"), "REJECT");
}

export async function cancelClientOrganizationInvitation(formData: FormData) {
  const actor = await requireCurrentProvider();
  const clientId = requiredId(formData, "clientId");
  const relationshipId = requiredId(formData, "relationshipId");
  return db.$transaction(async (tx) => {
    await requireTeamManager(tx, actor.id, clientId);
    const relationship = await tx.clientOrganization.findFirst({
      where: {
        id: relationshipId,
        clientId,
        role: "PARTICIPATING",
        status: "PENDING",
        revokedAt: null,
      },
      select: { organizationId: true },
    });
    if (!relationship) throw new Error("That invitation is no longer pending.");
    const updated = await tx.clientOrganization.updateMany({
      where: { id: relationshipId, status: "PENDING", revokedAt: null },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedById: actor.id,
        revocationReason: "CANCELLED_BY_TEAM_MANAGER",
      },
    });
    if (updated.count !== 1) throw new Error("That invitation changed. Try again.");
    await tx.clientTeamAuditEvent.create({
      data: {
        clientId,
        actorId: actor.id,
        action: "ORGANIZATION_REVOKED",
        organizationId: relationship.organizationId,
        metadata: boundedClientTeamAuditMetadata({ transition: "CANCELLED" }),
      },
    });
  });
  refreshClientTeam(clientId);
}

export async function revokeClientOrganization(formData: FormData) {
  const actor = await requireCurrentProvider();
  const clientId = requiredId(formData, "clientId");
  const relationshipId = requiredId(formData, "relationshipId");
  await db.$transaction(
    async (tx) => {
      await requireTeamManager(tx, actor.id, clientId);
      const relationship = await tx.clientOrganization.findFirst({
        where: {
          id: relationshipId,
          clientId,
          role: "PARTICIPATING",
          status: "ACTIVE",
          revokedAt: null,
        },
        select: { organizationId: true },
      });
      if (!relationship) throw new Error("The lead organization cannot be revoked here.");
      const assignments = await tx.providerClient.findMany({
        where: { clientId, organizationId: relationship.organizationId, revokedAt: null },
        select: { id: true, providerId: true },
      });
      const affectedManagers = assignments.length
        ? await tx.clientTeamManager.findMany({
            where: {
              clientId,
              providerId: { in: assignments.map(({ providerId }) => providerId) },
              revokedAt: null,
            },
            select: { providerId: true },
          })
        : [];
      const now = new Date();
      const updated = await tx.clientOrganization.updateMany({
        where: { id: relationshipId, status: "ACTIVE", revokedAt: null },
        data: {
          status: "REVOKED",
          revokedAt: now,
          revokedById: actor.id,
          revocationReason: "REVOKED_BY_TEAM_MANAGER",
        },
      });
      if (updated.count !== 1) throw new Error("That organization changed. Try again.");
      if (assignments.length) {
        await tx.providerClient.updateMany({
          where: { id: { in: assignments.map(({ id }) => id) }, revokedAt: null },
          data: {
            revokedAt: now,
            revokedById: actor.id,
            revocationReason: "ORGANIZATION_REVOKED",
          },
        });
        await tx.clientTeamManager.updateMany({
          where: {
            clientId,
            providerId: { in: assignments.map(({ providerId }) => providerId) },
            revokedAt: null,
          },
          data: { revokedAt: now, revokedById: actor.id },
        });
      }
      await tx.clientTeamAuditEvent.createMany({
        data: [
          {
            clientId,
            actorId: actor.id,
            action: "ORGANIZATION_REVOKED",
            organizationId: relationship.organizationId,
            metadata: boundedClientTeamAuditMetadata({ transition: "REVOKED" }),
          },
          ...assignments.map((assignment) => ({
            clientId,
            actorId: actor.id,
            action: "PROVIDER_REVOKED" as const,
            subjectProviderId: assignment.providerId,
            organizationId: relationship.organizationId,
            assignmentId: assignment.id,
            metadata: boundedClientTeamAuditMetadata({ cause: "ORGANIZATION_REVOKED" }),
          })),
          ...affectedManagers.map((manager) => ({
            clientId,
            actorId: actor.id,
            action: "TEAM_MANAGER_REVOKED" as const,
            subjectProviderId: manager.providerId,
            organizationId: relationship.organizationId,
            metadata: boundedClientTeamAuditMetadata({ cause: "ORGANIZATION_REVOKED" }),
          })),
        ],
      });
    },
    { isolationLevel: "Serializable" }
  );
  refreshClientTeam(clientId);
}

export async function searchEligibleClientProviders(
  clientId: string,
  organizationId: string,
  query = ""
) {
  const actor = await requireCurrentProvider();
  return db.$transaction(async (tx) => {
    await requireTeamManager(tx, actor.id, clientId);
    const participation = await tx.clientOrganization.findFirst({
      where: activeClientOrganizationWhere(clientId, organizationId),
      select: { id: true },
    });
    if (!participation) throw new Error("That organization is not active for this client.");
    const normalizedQuery = query.trim();
    return tx.provider.findMany({
      where: {
        ...eligibleProvidersInOrganizationWhere(organizationId),
        ...(normalizedQuery
          ? {
              OR: [
                { firstName: { contains: normalizedQuery, mode: "insensitive" } },
                { lastName: { contains: normalizedQuery, mode: "insensitive" } },
              ],
            }
          : {}),
        providerClients: { none: { clientId, revokedAt: null } },
      },
      orderBy: [{ role: "asc" }, { lastName: "asc" }, { id: "asc" }],
      take: PROVIDER_RESULT_LIMIT,
      select: { id: true, firstName: true, lastName: true, role: true },
    });
  });
}

export async function assignClientProvider(formData: FormData) {
  const actor = await requireCurrentProvider();
  const clientId = requiredId(formData, "clientId");
  const organizationId = requiredId(formData, "organizationId");
  const providerId = requiredId(formData, "providerId");
  const roleValue = requiredId(formData, "role");
  if (!isEligibleClientAssignmentRole(roleValue)) {
    throw new Error("That provider role cannot be assigned.");
  }
  const role = roleValue as Role;

  await db.$transaction(
    async (tx) => {
      await requireTeamManager(tx, actor.id, clientId);
      const [participation, provider, existing] = await Promise.all([
        tx.clientOrganization.findFirst({
          where: activeClientOrganizationWhere(clientId, organizationId),
          select: { id: true },
        }),
        tx.provider.findFirst({
          where: eligibleProviderWhere(providerId, organizationId),
          select: { id: true },
        }),
        tx.providerClient.findUnique({
          where: { providerId_clientId: { providerId, clientId } },
          select: { id: true, revokedAt: true },
        }),
      ]);
      if (!participation || !provider) throw new Error("That provider is not eligible.");
      if (existing?.revokedAt === null) throw new Error("That provider is already assigned.");

      const assignment = existing
        ? await tx.providerClient.update({
            where: { id: existing.id },
            data: {
              organizationId,
              role,
              assignedById: actor.id,
              assignedAt: new Date(),
              revokedAt: null,
              revokedById: null,
              revocationReason: null,
            },
            select: { id: true },
          })
        : await tx.providerClient.create({
            data: { clientId, providerId, organizationId, role, assignedById: actor.id },
            select: { id: true },
          });
      await tx.clientTeamAuditEvent.create({
        data: {
          clientId,
          actorId: actor.id,
          action: existing ? "PROVIDER_REACTIVATED" : "PROVIDER_ASSIGNED",
          subjectProviderId: providerId,
          organizationId,
          assignmentId: assignment.id,
          metadata: boundedClientTeamAuditMetadata({ role }),
        },
      });
    },
    { isolationLevel: "Serializable" }
  );
  refreshClientTeam(clientId);
}

export async function revokeClientProvider(formData: FormData) {
  const actor = await requireCurrentProvider();
  const clientId = requiredId(formData, "clientId");
  const assignmentId = requiredId(formData, "assignmentId");
  await db.$transaction(async (tx) => {
    await requireTeamManager(tx, actor.id, clientId);
    const assignment = await tx.providerClient.findFirst({
      where: { id: assignmentId, clientId, revokedAt: null },
      select: { id: true, providerId: true, organizationId: true },
    });
    if (!assignment) throw new Error("That assignment is no longer active.");
    const manager = await tx.clientTeamManager.findFirst({
      where: { clientId, providerId: assignment.providerId, revokedAt: null },
      select: { id: true },
    });
    const now = new Date();
    const updated = await tx.providerClient.updateMany({
      where: { id: assignment.id, revokedAt: null },
      data: {
        revokedAt: now,
        revokedById: actor.id,
        revocationReason: "REVOKED_BY_TEAM_MANAGER",
      },
    });
    if (updated.count !== 1) throw new Error("That assignment changed. Try again.");
    await tx.clientTeamManager.updateMany({
      where: { clientId, providerId: assignment.providerId, revokedAt: null },
      data: { revokedAt: now, revokedById: actor.id },
    });
    await tx.clientTeamAuditEvent.createMany({
      data: [
        {
          clientId,
          actorId: actor.id,
          action: "PROVIDER_REVOKED",
          subjectProviderId: assignment.providerId,
          organizationId: assignment.organizationId,
          assignmentId: assignment.id,
        },
        ...(manager
          ? [
              {
                clientId,
                actorId: actor.id,
                action: "TEAM_MANAGER_REVOKED" as const,
                subjectProviderId: assignment.providerId,
                organizationId: assignment.organizationId,
              },
            ]
          : []),
      ],
    });
  });
  refreshClientTeam(clientId);
}
