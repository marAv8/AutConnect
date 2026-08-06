-- Add explicit organization affiliation without guessing from provider profession.
CREATE TYPE "OrganizationType" AS ENUM ('AGENCY', 'SCHOOL', 'DISTRICT', 'INDEPENDENT');
CREATE TYPE "OrganizationMembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMembership" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "role" "OrganizationMembershipRole" NOT NULL DEFAULT 'MEMBER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ProviderClient" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "CaseSupportCase" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "CaseSupportRequest" ADD COLUMN "organizationId" TEXT;

CREATE UNIQUE INDEX "Organization_normalizedName_key" ON "Organization"("normalizedName");
CREATE INDEX "Organization_type_name_idx" ON "Organization"("type", "name");
CREATE UNIQUE INDEX "OrganizationMembership_organizationId_providerId_key" ON "OrganizationMembership"("organizationId", "providerId");
CREATE INDEX "OrganizationMembership_providerId_active_idx" ON "OrganizationMembership"("providerId", "active");
CREATE INDEX "ProviderClient_clientId_organizationId_idx" ON "ProviderClient"("clientId", "organizationId");
CREATE INDEX "CaseSupportCase_organizationId_status_idx" ON "CaseSupportCase"("organizationId", "status");
CREATE INDEX "CaseSupportRequest_organizationId_status_idx" ON "CaseSupportRequest"("organizationId", "status");

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMembership"
ADD CONSTRAINT "OrganizationMembership_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProviderClient"
ADD CONSTRAINT "ProviderClient_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseSupportCase"
ADD CONSTRAINT "CaseSupportCase_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CaseSupportRequest"
ADD CONSTRAINT "CaseSupportRequest_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
