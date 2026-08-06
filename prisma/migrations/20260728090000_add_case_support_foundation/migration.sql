CREATE TYPE "CaseSupportStatus" AS ENUM ('OPEN', 'RESOLVED', 'ARCHIVED');

CREATE TYPE "CaseSupportAccessLevel" AS ENUM ('CONTRIBUTOR', 'VIEWER');

CREATE TABLE "CaseSupportCase" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ownerSupervisorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "concern" TEXT NOT NULL,
    "desiredOutcome" TEXT NOT NULL,
    "status" "CaseSupportStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "CaseSupportCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseSupportMember" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "grantedById" TEXT NOT NULL,
    "accessLevel" "CaseSupportAccessLevel" NOT NULL DEFAULT 'CONTRIBUTOR',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "CaseSupportMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CaseSupportAuditEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseSupportAuditEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseSupportCase_clientId_status_updatedAt_idx"
ON "CaseSupportCase"("clientId", "status", "updatedAt");

CREATE INDEX "CaseSupportCase_ownerSupervisorId_status_idx"
ON "CaseSupportCase"("ownerSupervisorId", "status");

CREATE UNIQUE INDEX "CaseSupportMember_caseId_providerId_key"
ON "CaseSupportMember"("caseId", "providerId");

CREATE INDEX "CaseSupportMember_providerId_revokedAt_idx"
ON "CaseSupportMember"("providerId", "revokedAt");

CREATE INDEX "CaseSupportMember_caseId_revokedAt_idx"
ON "CaseSupportMember"("caseId", "revokedAt");

CREATE INDEX "CaseSupportAuditEvent_caseId_createdAt_idx"
ON "CaseSupportAuditEvent"("caseId", "createdAt");

CREATE INDEX "CaseSupportAuditEvent_actorId_createdAt_idx"
ON "CaseSupportAuditEvent"("actorId", "createdAt");

ALTER TABLE "CaseSupportCase"
ADD CONSTRAINT "CaseSupportCase_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseSupportCase"
ADD CONSTRAINT "CaseSupportCase_ownerSupervisorId_fkey"
FOREIGN KEY ("ownerSupervisorId") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseSupportMember"
ADD CONSTRAINT "CaseSupportMember_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "CaseSupportCase"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseSupportMember"
ADD CONSTRAINT "CaseSupportMember_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseSupportMember"
ADD CONSTRAINT "CaseSupportMember_grantedById_fkey"
FOREIGN KEY ("grantedById") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseSupportAuditEvent"
ADD CONSTRAINT "CaseSupportAuditEvent_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "CaseSupportCase"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseSupportAuditEvent"
ADD CONSTRAINT "CaseSupportAuditEvent_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
