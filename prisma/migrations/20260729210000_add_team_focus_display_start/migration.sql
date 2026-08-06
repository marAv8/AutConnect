-- Keep the Team Focus display clock separate from content edits.
ALTER TABLE "public"."TeamFocus"
ADD COLUMN "displayStartedAt" TIMESTAMP(3);

-- Existing records retain their original publication date.
UPDATE "public"."TeamFocus"
SET "displayStartedAt" = "createdAt";

ALTER TABLE "public"."TeamFocus"
ALTER COLUMN "displayStartedAt" SET NOT NULL,
ALTER COLUMN "displayStartedAt" SET DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX "TeamFocus_clientId_isActive_displayStartedAt_idx"
ON "public"."TeamFocus"("clientId", "isActive", "displayStartedAt");
