CREATE TYPE "GoalMasteryBasis" AS ENUM ('LEGACY_NORMALIZED', 'POLICY_V1');

ALTER TABLE "GoalDefinition"
ADD COLUMN "masteryBasis" "GoalMasteryBasis",
ADD COLUMN "masteredAt" TIMESTAMP(3),
ADD COLUMN "masteryEvidenceEntryIds" JSONB,
ADD COLUMN "masteryThreshold" DOUBLE PRECISION,
ADD COLUMN "masteryRequiredSessions" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE "GoalDefinition"
ADD CONSTRAINT "GoalDefinition_masteryRequiredSessions_check"
CHECK ("masteryRequiredSessions" BETWEEN 1 AND 20);

UPDATE "GoalDefinition"
SET "masteryBasis" = 'LEGACY_NORMALIZED'
WHERE "isMastered" = true;
