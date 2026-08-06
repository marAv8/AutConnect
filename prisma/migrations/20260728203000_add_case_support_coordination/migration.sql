CREATE TYPE "CaseSupportCoordinationPath" AS ENUM (
    'INTERNAL',
    'EXTERNAL'
);

CREATE TYPE "CaseSupportCoordinationStatus" AS ENUM (
    'DOCUMENTED',
    'AWAITING_RESPONSE',
    'RESPONSE_RECEIVED',
    'MONITORING',
    'FOLLOW_UP_NEEDED',
    'COMPLETE'
);

CREATE TYPE "CaseSupportCommunicationMethod" AS ENUM (
    'EMAIL',
    'PHONE',
    'IN_PERSON',
    'VIRTUAL_MEETING',
    'WRITTEN_NOTICE',
    'OTHER'
);

CREATE TABLE "CaseSupportCoordination" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "path" "CaseSupportCoordinationPath" NOT NULL,
    "status" "CaseSupportCoordinationStatus" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "contactOrganization" TEXT,
    "contactRole" TEXT,
    "contactName" TEXT,
    "communicationMethod" "CaseSupportCommunicationMethod",
    "actionTaken" TEXT NOT NULL,
    "requestOrDecision" TEXT NOT NULL,
    "responseSummary" TEXT,
    "nextStep" TEXT,
    "followUpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CaseSupportCoordination_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CaseSupportCoordination_caseId_occurredAt_idx"
ON "CaseSupportCoordination"("caseId", "occurredAt");

CREATE INDEX "CaseSupportCoordination_authorId_createdAt_idx"
ON "CaseSupportCoordination"("authorId", "createdAt");

CREATE INDEX "CaseSupportCoordination_path_status_idx"
ON "CaseSupportCoordination"("path", "status");

ALTER TABLE "CaseSupportCoordination"
ADD CONSTRAINT "CaseSupportCoordination_caseId_fkey"
FOREIGN KEY ("caseId") REFERENCES "CaseSupportCase"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CaseSupportCoordination"
ADD CONSTRAINT "CaseSupportCoordination_authorId_fkey"
FOREIGN KEY ("authorId") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
