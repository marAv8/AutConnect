-- Phase 1 multi-organization Client-team foundation.
-- This migration is additive and intentionally does not infer organization
-- provenance for nullable assignments or choose a lead from multiple organizations.

-- Abort without changing data if the legacy table contains duplicate
-- provider/client relationships. Those conflicts require explicit review.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ProviderClient"
    GROUP BY "providerId", "clientId"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'ProviderClient contains duplicate provider/client relationships; review conflicts before applying this migration';
  END IF;
END $$;

CREATE TYPE "ProviderStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DISABLED');
CREATE TYPE "ClientOrganizationRole" AS ENUM ('LEAD', 'PARTICIPATING');
CREATE TYPE "ClientOrganizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');
CREATE TYPE "ClientTeamAuditAction" AS ENUM (
  'ORGANIZATION_REQUESTED',
  'ORGANIZATION_APPROVED',
  'ORGANIZATION_REVOKED',
  'TEAM_MANAGER_GRANTED',
  'TEAM_MANAGER_REVOKED',
  'PROVIDER_ASSIGNED',
  'PROVIDER_REVOKED',
  'PROVIDER_REACTIVATED',
  'LEAD_ORGANIZATION_CHANGED'
);

ALTER TABLE "Provider"
ADD COLUMN "status" "ProviderStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Client"
ADD COLUMN "caseCode" TEXT;

UPDATE "Client"
SET "caseCode" = gen_random_uuid()::text
WHERE "caseCode" IS NULL;

ALTER TABLE "Client"
ALTER COLUMN "caseCode" SET NOT NULL;

CREATE UNIQUE INDEX "Client_caseCode_key" ON "Client"("caseCode");

ALTER TABLE "Organization"
ADD COLUMN "parentOrganizationId" TEXT;

CREATE INDEX "Organization_parentOrganizationId_idx"
ON "Organization"("parentOrganizationId");

ALTER TABLE "Organization"
ADD CONSTRAINT "Organization_parentOrganizationId_fkey"
FOREIGN KEY ("parentOrganizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProviderClient"
ADD COLUMN "assignedById" TEXT,
ADD COLUMN "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "revokedAt" TIMESTAMP(3),
ADD COLUMN "revokedById" TEXT,
ADD COLUMN "revocationReason" TEXT;

ALTER TABLE "ProviderClient"
ADD CONSTRAINT "ProviderClient_assignedById_fkey"
FOREIGN KEY ("assignedById") REFERENCES "Provider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProviderClient"
ADD CONSTRAINT "ProviderClient_revokedById_fkey"
FOREIGN KEY ("revokedById") REFERENCES "Provider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "ProviderClient_providerId_clientId_key"
ON "ProviderClient"("providerId", "clientId");

CREATE TABLE "ClientOrganization" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" "ClientOrganizationRole" NOT NULL,
  "status" "ClientOrganizationStatus" NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT NOT NULL,
  "approvedById" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activatedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,
  "revocationReason" TEXT,

  CONSTRAINT "ClientOrganization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientOrganization_clientId_organizationId_key"
ON "ClientOrganization"("clientId", "organizationId");
CREATE INDEX "ClientOrganization_clientId_status_idx"
ON "ClientOrganization"("clientId", "status");
CREATE INDEX "ClientOrganization_organizationId_status_idx"
ON "ClientOrganization"("organizationId", "status");

-- Prisma cannot express conditional uniqueness. This index permits historical
-- revoked leads while enforcing at most one currently active lead per Client.
CREATE UNIQUE INDEX "ClientOrganization_one_active_lead_per_client"
ON "ClientOrganization"("clientId")
WHERE "role" = 'LEAD'
  AND "status" = 'ACTIVE'
  AND "revokedAt" IS NULL;

ALTER TABLE "ClientOrganization"
ADD CONSTRAINT "ClientOrganization_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientOrganization"
ADD CONSTRAINT "ClientOrganization_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientOrganization"
ADD CONSTRAINT "ClientOrganization_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientOrganization"
ADD CONSTRAINT "ClientOrganization_approvedById_fkey"
FOREIGN KEY ("approvedById") REFERENCES "Provider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientOrganization"
ADD CONSTRAINT "ClientOrganization_revokedById_fkey"
FOREIGN KEY ("revokedById") REFERENCES "Provider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClientTeamManager" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "grantedById" TEXT NOT NULL,
  "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedById" TEXT,

  CONSTRAINT "ClientTeamManager_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientTeamManager_clientId_providerId_key"
ON "ClientTeamManager"("clientId", "providerId");
CREATE INDEX "ClientTeamManager_providerId_revokedAt_idx"
ON "ClientTeamManager"("providerId", "revokedAt");
CREATE INDEX "ClientTeamManager_clientId_revokedAt_idx"
ON "ClientTeamManager"("clientId", "revokedAt");

ALTER TABLE "ClientTeamManager"
ADD CONSTRAINT "ClientTeamManager_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientTeamManager"
ADD CONSTRAINT "ClientTeamManager_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientTeamManager"
ADD CONSTRAINT "ClientTeamManager_grantedById_fkey"
FOREIGN KEY ("grantedById") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientTeamManager"
ADD CONSTRAINT "ClientTeamManager_revokedById_fkey"
FOREIGN KEY ("revokedById") REFERENCES "Provider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ClientTeamAuditEvent" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" "ClientTeamAuditAction" NOT NULL,
  "subjectProviderId" TEXT,
  "organizationId" TEXT,
  "assignmentId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientTeamAuditEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientTeamAuditEvent_metadata_size_check"
    CHECK ("metadata" IS NULL OR pg_column_size("metadata") <= 4096)
);

CREATE INDEX "ClientTeamAuditEvent_clientId_createdAt_idx"
ON "ClientTeamAuditEvent"("clientId", "createdAt");
CREATE INDEX "ClientTeamAuditEvent_actorId_createdAt_idx"
ON "ClientTeamAuditEvent"("actorId", "createdAt");
CREATE INDEX "ClientTeamAuditEvent_assignmentId_idx"
ON "ClientTeamAuditEvent"("assignmentId");

ALTER TABLE "ClientTeamAuditEvent"
ADD CONSTRAINT "ClientTeamAuditEvent_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientTeamAuditEvent"
ADD CONSTRAINT "ClientTeamAuditEvent_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClientTeamAuditEvent"
ADD CONSTRAINT "ClientTeamAuditEvent_subjectProviderId_fkey"
FOREIGN KEY ("subjectProviderId") REFERENCES "Provider"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClientTeamAuditEvent"
ADD CONSTRAINT "ClientTeamAuditEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
CREATE FUNCTION "prevent_client_team_audit_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ClientTeamAuditEvent is append-only';
END;
$$;

CREATE TRIGGER "ClientTeamAuditEvent_append_only"
BEFORE UPDATE OR DELETE ON "ClientTeamAuditEvent"
FOR EACH ROW
EXECUTE FUNCTION "prevent_client_team_audit_mutation"();

-- Backfill only unambiguous Client/organization relationships: exactly one
-- distinct non-null assignment organization and exactly one Supervisor
-- assignment through that organization. No Team Manager is inferred because
-- the historical creator/grantor cannot be proven from existing rows.
WITH "SingleOrganization" AS (
  SELECT "clientId", MIN("organizationId") AS "organizationId"
  FROM "ProviderClient"
  WHERE "organizationId" IS NOT NULL
  GROUP BY "clientId"
  HAVING COUNT(DISTINCT "organizationId") = 1
),
"SingleSupervisor" AS (
  SELECT "clientId", "organizationId", MIN("providerId") AS "providerId"
  FROM "ProviderClient"
  WHERE "role" = 'Supervisor' AND "organizationId" IS NOT NULL
  GROUP BY "clientId", "organizationId"
  HAVING COUNT(*) = 1
)
INSERT INTO "ClientOrganization" (
  "id",
  "clientId",
  "organizationId",
  "role",
  "status",
  "requestedById",
  "approvedById",
  "requestedAt",
  "activatedAt"
)
SELECT
  gen_random_uuid()::text,
  single_org."clientId",
  single_org."organizationId",
  'LEAD'::"ClientOrganizationRole",
  'ACTIVE'::"ClientOrganizationStatus",
  supervisor."providerId",
  supervisor."providerId",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SingleOrganization" single_org
JOIN "SingleSupervisor" supervisor
  ON supervisor."clientId" = single_org."clientId"
 AND supervisor."organizationId" = single_org."organizationId";
