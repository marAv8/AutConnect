import type { Prisma, Role } from "@prisma/client";

export const CLIENT_ASSIGNMENT_ROLES: Role[] = [
  "Caregiver",
  "BehaviorTherapist",
  "Educator",
  "SpeechPathologist",
  "OccupationalTherapist",
];

export function activeClientOrganizationWhere(
  clientId: string,
  organizationId: string
): Prisma.ClientOrganizationWhereInput {
  return {
    clientId,
    organizationId,
    status: "ACTIVE",
    revokedAt: null,
  };
}

export function activeOrganizationMembershipWhere(
  providerId: string,
  organizationId: string
): Prisma.OrganizationMembershipWhereInput {
  return {
    providerId,
    organizationId,
    active: true,
    provider: { status: "ACTIVE" },
  };
}

export function activeClientAssignmentWhere(
  providerId: string,
  clientId: string
): Prisma.ProviderClientWhereInput {
  return {
    providerId,
    clientId,
    revokedAt: null,
    provider: { status: "ACTIVE" },
    OR: [
      // Compatibility for assignments created before organization provenance.
      { organizationId: null },
      {
        organization: {
          memberships: {
            some: {
              providerId,
              active: true,
            },
          },
          clientOrganizations: {
            some: {
              clientId,
              status: "ACTIVE",
              revokedAt: null,
            },
          },
        },
      },
    ],
  };
}

export function activeClientTeamManagerWhere(
  providerId: string,
  clientId: string
): Prisma.ClientTeamManagerWhereInput {
  return {
    providerId,
    clientId,
    revokedAt: null,
    provider: { status: "ACTIVE" },
    client: {
      providerClients: {
        some: activeClientAssignmentWhere(providerId, clientId),
      },
    },
  };
}

export function eligibleProvidersInOrganizationWhere(
  organizationId: string
): Prisma.ProviderWhereInput {
  return {
    status: "ACTIVE",
    role: { in: CLIENT_ASSIGNMENT_ROLES },
    organizationMemberships: {
      some: {
        organizationId,
        active: true,
      },
    },
  };
}

export function eligibleProviderWhere(
  providerId: string,
  organizationId: string
): Prisma.ProviderWhereInput {
  return {
    ...eligibleProvidersInOrganizationWhere(organizationId),
    id: providerId,
  };
}

export function isEligibleClientAssignmentRole(role: string): role is Role {
  return CLIENT_ASSIGNMENT_ROLES.includes(role as Role);
}

export function isValidOrganizationParent(
  childType: string,
  parentType: string | null
) {
  if (parentType === null) return true;
  return childType === "SCHOOL" && parentType === "DISTRICT";
}

const MAX_AUDIT_METADATA_KEYS = 12;
const MAX_AUDIT_METADATA_KEY_LENGTH = 64;
const MAX_AUDIT_METADATA_STRING_LENGTH = 256;

export function boundedClientTeamAuditMetadata(
  metadata: Record<string, string | number | boolean | null>
): Prisma.InputJsonObject {
  const entries = Object.entries(metadata);
  if (entries.length > MAX_AUDIT_METADATA_KEYS) {
    throw new Error("Client-team audit metadata has too many fields.");
  }

  return Object.fromEntries(
    entries.map(([key, value]) => {
      if (!key || key.length > MAX_AUDIT_METADATA_KEY_LENGTH) {
        throw new Error("Client-team audit metadata contains an invalid key.");
      }
      if (
        typeof value === "string" &&
        value.length > MAX_AUDIT_METADATA_STRING_LENGTH
      ) {
        throw new Error("Client-team audit metadata contains an oversized value.");
      }
      return [key, value];
    })
  );
}
