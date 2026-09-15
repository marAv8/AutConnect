import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import {
  activeClientAssignmentWhere,
  activeClientOrganizationWhere,
  activeClientTeamManagerWhere,
  activeOrganizationMembershipWhere,
  eligibleProviderWhere,
  isEligibleClientAssignmentRole,
} from "@/lib/clientTeamAuthorizationPolicy";

export async function hasActiveClientAccess(
  providerId: string,
  clientId: string
) {
  const assignment = await db.providerClient.findFirst({
    where: activeClientAssignmentWhere(providerId, clientId),
    select: { id: true },
  });
  return Boolean(assignment);
}

export async function hasActiveClientOrganizationParticipation(
  clientId: string,
  organizationId: string
) {
  const participation = await db.clientOrganization.findFirst({
    where: activeClientOrganizationWhere(clientId, organizationId),
    select: { id: true },
  });
  return Boolean(participation);
}

export async function hasActiveOrganizationMembership(
  providerId: string,
  organizationId: string
) {
  const membership = await db.organizationMembership.findFirst({
    where: activeOrganizationMembershipWhere(providerId, organizationId),
    select: { id: true },
  });
  return Boolean(membership);
}

export async function hasActiveClientTeamManagerAuthority(
  providerId: string,
  clientId: string
) {
  const manager = await db.clientTeamManager.findFirst({
    where: activeClientTeamManagerWhere(providerId, clientId),
    select: { id: true },
  });
  return Boolean(manager);
}

export type ProviderAssignmentEligibility =
  | { allowed: true }
  | {
      allowed: false;
      reason:
        | "inactive_actor"
        | "missing_actor_assignment"
        | "missing_team_manager_authority"
        | "inactive_client_organization"
        | "ineligible_role"
        | "ineligible_provider"
        | "active_assignment_exists";
    };

export async function evaluateProviderAssignmentEligibility(input: {
  actorProviderId: string;
  clientId: string;
  targetProviderId: string;
  organizationId: string;
  role: Role;
}): Promise<ProviderAssignmentEligibility> {
  if (!isEligibleClientAssignmentRole(input.role)) {
    return { allowed: false, reason: "ineligible_role" };
  }

  const actor = await db.provider.findFirst({
    where: { id: input.actorProviderId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!actor) return { allowed: false, reason: "inactive_actor" };

  if (!(await hasActiveClientAccess(input.actorProviderId, input.clientId))) {
    return { allowed: false, reason: "missing_actor_assignment" };
  }

  if (
    !(await hasActiveClientTeamManagerAuthority(
      input.actorProviderId,
      input.clientId
    ))
  ) {
    return { allowed: false, reason: "missing_team_manager_authority" };
  }

  if (
    !(await hasActiveClientOrganizationParticipation(
      input.clientId,
      input.organizationId
    ))
  ) {
    return { allowed: false, reason: "inactive_client_organization" };
  }

  const targetProvider = await db.provider.findFirst({
    where: eligibleProviderWhere(
      input.targetProviderId,
      input.organizationId
    ),
    select: { id: true },
  });
  if (!targetProvider) {
    return { allowed: false, reason: "ineligible_provider" };
  }

  const existingAssignment = await db.providerClient.findFirst({
    where: {
      providerId: input.targetProviderId,
      clientId: input.clientId,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (existingAssignment) {
    return { allowed: false, reason: "active_assignment_exists" };
  }

  return { allowed: true };
}
