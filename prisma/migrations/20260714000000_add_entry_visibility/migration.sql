CREATE TYPE "public"."EntryVisibility" AS ENUM ('Private', 'Shared');

ALTER TABLE "public"."Entry"
ADD COLUMN "visibility" "public"."EntryVisibility" NOT NULL DEFAULT 'Shared';

UPDATE "public"."Entry"
SET "visibility" = 'Private'
WHERE "kind" IN ('SupervisorObservation', 'ClinicalNote');

CREATE INDEX "Entry_clientId_visibility_date_idx" ON "public"."Entry"("clientId", "visibility", "date");

ALTER TABLE "public"."AssessmentItem" DROP CONSTRAINT "AssessmentItem_entryId_fkey";
ALTER TABLE "public"."AssessmentItem"
ADD CONSTRAINT "AssessmentItem_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."EntryRead" DROP CONSTRAINT "EntryRead_entryId_fkey";
ALTER TABLE "public"."EntryRead"
ADD CONSTRAINT "EntryRead_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
