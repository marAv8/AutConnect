CREATE TYPE "CaseSupportNotificationType" AS ENUM (
  'CASE_UPDATE',
  'CLARIFICATION',
  'CASE_OPENED',
  'ACCESS_GRANTED',
  'CASE_RESOLVED'
);

CREATE TABLE "CaseSupportNotification" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "eventType" "CaseSupportNotificationType" NOT NULL,
  "eventKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),

  CONSTRAINT "CaseSupportNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaseSupportNotification_recipientId_eventKey_key"
  ON "CaseSupportNotification"("recipientId", "eventKey");

CREATE INDEX "CaseSupportNotification_recipientId_readAt_createdAt_idx"
  ON "CaseSupportNotification"("recipientId", "readAt", "createdAt");

CREATE INDEX "CaseSupportNotification_caseId_recipientId_readAt_idx"
  ON "CaseSupportNotification"("caseId", "recipientId", "readAt");

ALTER TABLE "CaseSupportNotification"
  ADD CONSTRAINT "CaseSupportNotification_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "CaseSupportCase"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseSupportNotification"
  ADD CONSTRAINT "CaseSupportNotification_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "Provider"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseSupportNotification"
  ADD CONSTRAINT "CaseSupportNotification_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "Provider"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
