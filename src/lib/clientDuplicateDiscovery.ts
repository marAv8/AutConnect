import { requireCurrentProvider } from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  POSSIBLE_DUPLICATE_LIMIT,
  possibleDuplicateDiscoveryScope,
  type PossibleDuplicateInput,
} from "@/lib/clientDuplicatePolicy";

export async function findAuthorizedPossibleClientDuplicates(
  input: PossibleDuplicateInput
) {
  const actor = await requireCurrentProvider();
  const scope = possibleDuplicateDiscoveryScope(actor.id, input);
  if (!scope) return [];

  return db.$queryRaw<
    Array<{
      id: string;
      caseCode: string;
      firstName: string;
      lastName: string;
      dateOfBirth: Date;
    }>
  >`
    SELECT
      client."id",
      client."caseCode",
      client."firstName",
      client."lastName",
      client."dateOfBirth"
    FROM "Client" client
    JOIN "ProviderClient" assignment
      ON assignment."clientId" = client."id"
     AND assignment."providerId" = ${scope.providerId}
     AND assignment."revokedAt" IS NULL
    JOIN "Provider" provider
      ON provider."id" = assignment."providerId"
     AND provider."status" = 'ACTIVE'::"ProviderStatus"
    LEFT JOIN "OrganizationMembership" membership
      ON membership."organizationId" = assignment."organizationId"
     AND membership."providerId" = assignment."providerId"
     AND membership."active" = true
    LEFT JOIN "ClientOrganization" participation
      ON participation."clientId" = assignment."clientId"
     AND participation."organizationId" = assignment."organizationId"
     AND participation."status" = 'ACTIVE'::"ClientOrganizationStatus"
     AND participation."revokedAt" IS NULL
    WHERE lower(client."firstName") = lower(${scope.firstName})
      AND lower(client."lastName") = lower(${scope.lastName})
      AND client."dateOfBirth" = ${scope.dateOfBirth}
      AND (
        assignment."organizationId" IS NULL
        OR (membership."id" IS NOT NULL AND participation."id" IS NOT NULL)
      )
    ORDER BY client."createdAt" DESC, client."id" ASC
    LIMIT ${POSSIBLE_DUPLICATE_LIMIT}
  `;
}
