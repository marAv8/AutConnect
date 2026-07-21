CREATE TYPE "public"."EntryStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED');

ALTER TABLE "public"."Entry"
ADD COLUMN "status" "public"."EntryStatus" NOT NULL DEFAULT 'IN_PROGRESS',
ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "public"."Entry"
SET "status" = 'COMPLETED',
    "completedAt" = COALESCE("updatedAt", "createdAt")
WHERE
  "note" IS NOT NULL
  OR EXISTS (
    SELECT 1
    FROM "public"."AssessmentItem"
    WHERE "AssessmentItem"."entryId" = "Entry"."id"
  )
  OR EXISTS (
    SELECT 1
    FROM "public"."AbcObservation"
    WHERE "AbcObservation"."entryId" = "Entry"."id"
  );

CREATE INDEX "Entry_clientId_providerId_date_status_idx"
ON "public"."Entry"("clientId", "providerId", "date", "status");
