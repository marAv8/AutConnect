CREATE TYPE "CaseSupportRequestStatus" AS ENUM (
  'REQUESTED',
  'ACKNOWLEDGED',
  'CASE_OPENED',
  'DECLINED'
);

CREATE TABLE "CaseSupportRequest" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "requesterId" TEXT NOT NULL,
  "recipientSupervisorId" TEXT NOT NULL,
  "linkedCaseId" TEXT,
  "concern" TEXT NOT NULL,
  "requestedSupport" TEXT NOT NULL,
  "status" "CaseSupportRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "responseNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "acknowledgedAt" TIMESTAMP(3),
  "respondedAt" TIMESTAMP(3),

  CONSTRAINT "CaseSupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseSupportRequest_recipientSupervisorId_status_createdAt_idx"
  ON "CaseSupportRequest"("recipientSupervisorId", "status", "createdAt");

CREATE INDEX "CaseSupportRequest_requesterId_clientId_createdAt_idx"
  ON "CaseSupportRequest"("requesterId", "clientId", "createdAt");

CREATE INDEX "CaseSupportRequest_clientId_status_idx"
  ON "CaseSupportRequest"("clientId", "status");

CREATE INDEX "CaseSupportRequest_linkedCaseId_idx"
  ON "CaseSupportRequest"("linkedCaseId");

ALTER TABLE "CaseSupportRequest"
  ADD CONSTRAINT "CaseSupportRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseSupportRequest"
  ADD CONSTRAINT "CaseSupportRequest_requesterId_fkey"
  FOREIGN KEY ("requesterId") REFERENCES "Provider"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseSupportRequest"
  ADD CONSTRAINT "CaseSupportRequest_recipientSupervisorId_fkey"
  FOREIGN KEY ("recipientSupervisorId") REFERENCES "Provider"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseSupportRequest"
  ADD CONSTRAINT "CaseSupportRequest_linkedCaseId_fkey"
  FOREIGN KEY ("linkedCaseId") REFERENCES "CaseSupportCase"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
