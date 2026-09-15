CREATE TABLE "OrganizationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "providerRole" TEXT NOT NULL,
    "membershipRole" "OrganizationMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "invitedByProviderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationInvitation_tokenHash_key"
ON "OrganizationInvitation"("tokenHash");

CREATE INDEX "OrganizationInvitation_normalizedEmail_expiresAt_idx"
ON "OrganizationInvitation"("normalizedEmail", "expiresAt");

CREATE INDEX "OrganizationInvitation_organizationId_acceptedAt_revokedAt_idx"
ON "OrganizationInvitation"("organizationId", "acceptedAt", "revokedAt");

ALTER TABLE "OrganizationInvitation"
ADD CONSTRAINT "OrganizationInvitation_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationInvitation"
ADD CONSTRAINT "OrganizationInvitation_invitedByProviderId_fkey"
FOREIGN KEY ("invitedByProviderId") REFERENCES "Provider"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
