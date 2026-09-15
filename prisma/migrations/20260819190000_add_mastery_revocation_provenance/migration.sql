ALTER TABLE "GoalDefinition"
ADD COLUMN "masteryRevokedAt" TIMESTAMP(3),
ADD COLUMN "masteryRevokedEvidenceEntryIds" JSONB;
