import type { OrganizationMembershipRole, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isPlatformAdminEmail } from "@/lib/platformAdminPolicy";
import {
  activeClientAssignmentWhere,
  activeClientTeamManagerWhere,
} from "@/lib/clientTeamAuthorizationPolicy";
export {
  managedClientWhere,
  organizationProviderWhere,
} from "@/lib/authorizationScope";

const ORGANIZATION_ADMIN_ROLES: OrganizationMembershipRole[] = ["OWNER", "ADMIN"];

export async function requireCurrentProvider() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const provider = await db.provider.findUnique({
    where: { id: session.providerId },
    select: { id: true, role: true, status: true },
  });

  if (
    !provider ||
    provider.role !== session.role ||
    provider.status !== "ACTIVE"
  ) {
    throw new Error("Unauthorized");
  }

  return provider;
}

export async function requireCurrentSupervisor() {
  const provider = await requireCurrentProvider();
  if (provider.role !== "Supervisor") {
    throw new Error("Unauthorized");
  }
  return provider;
}

export async function requireCurrentPlatformAdmin() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const provider = await db.provider.findUnique({
    where: { id: session.providerId },
    select: { id: true, email: true, role: true, status: true },
  });

  if (
    !provider ||
    provider.role !== session.role ||
    provider.status !== "ACTIVE" ||
    !isPlatformAdminEmail(provider.email)
  ) {
    throw new Error("Unauthorized");
  }

  return provider;
}

export async function getManagedOrganizationIds(providerId: string, transaction: Prisma.TransactionClient = db) {
  const memberships = await transaction.organizationMembership.findMany({
    where: {
      providerId,
      active: true,
      role: { in: ORGANIZATION_ADMIN_ROLES },
      provider: { status: "ACTIVE" },
    },
    select: { organizationId: true },
  });
  return memberships.map(({ organizationId }) => organizationId);
}

export async function canAccessClient(providerId: string, clientId: string) {
  const assignment = await db.providerClient.findFirst({
    where: activeClientAssignmentWhere(providerId, clientId),
    select: { id: true },
  });
  return Boolean(assignment);
}

export async function canManageClient(providerId: string, clientId: string) {
  const manager = await db.clientTeamManager.findFirst({
    where: activeClientTeamManagerWhere(providerId, clientId),
    select: { id: true },
  });
  return Boolean(manager);
}
