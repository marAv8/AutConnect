import type { Prisma } from "@prisma/client";

export function managedClientWhere(
  providerId: string,
  managedOrganizationIds: string[]
): Prisma.ClientWhereInput {
  void managedOrganizationIds;
  return {
    providerClients: {
      some: {
        providerId,
        role: "Supervisor",
        revokedAt: null,
      },
    },
  };
}

export function organizationProviderWhere(
  managedOrganizationIds: string[]
): Prisma.ProviderWhereInput {
  return managedOrganizationIds.length
    ? {
        organizationMemberships: {
          some: {
            organizationId: { in: managedOrganizationIds },
            active: true,
          },
        },
      }
    : { id: { in: [] } };
}
