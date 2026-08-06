CREATE TYPE "CaseSupportEntryType" AS ENUM (
    'PROVIDER_ACCOUNT',
    'SUPERVISOR_COORDINATION',
    'CLARIFICATION'
);

CREATE TYPE "CaseSupportRequestSource" AS ENUM (
    'CLASSROOM_STAFF',
    'SCHOOL_ADMINISTRATION',
    'AGENCY_SUPERVISOR',
    'SAFETY_NEED',
    'SELF_INITIATED',
    'OTHER',
    'UNCLEAR'
);

CREATE TYPE "CaseSupportCoverageStatus" AS ENUM (
    'MAINTAINED',
    'TEMPORARILY_REASSIGNED',
    'NOT_MAINTAINED',
    'UNCLEAR'
);

CREATE TABLE "CaseSupportEntry" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "amendsEntryId" TEXT,
    "entryType" "CaseSupportEntryType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "requestSource" "CaseSupportRequestSource" NOT NULL,
    "requestedBy" TEXT,
    "coverageStatus" "CaseSupportCoverageStatus" NOT NULL,
    "durationMinutes" INTEGER,
    "scheduleImpacts" TEXT[],
    "whatOccurred" TEXT NOT NULL,
    "supportProvided" TEXT NOT NULL,
    "observableOutcome" TEXT NOT NULL,
    "communication" TEXT,
    "followUp" TEXT,
    "clarification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseSupportEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseSupportEntry_caseId_occurredAt_idx"
ON "CaseSupportEntry"("caseId", "occurredAt");

CREATE INDEX "CaseSupportEntry_authorId_createdAt_idx"
ON "CaseSupportEntry"("authorId", "createdAt");

CREATE INDEX "CaseSupportEntry_amendsEntryId_idx"
ON "CaseSupportEntry"("amendsEntryId");

ALTER TABLE "CaseSupportEntry"
ADD CONSTRAINT "CaseSupportEntry_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "CaseSupportCase"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseSupportEntry"
ADD CONSTRAINT "CaseSupportEntry_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CaseSupportEntry"
ADD CONSTRAINT "CaseSupportEntry_amendsEntryId_fkey"
FOREIGN KEY ("amendsEntryId") REFERENCES "CaseSupportEntry"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
