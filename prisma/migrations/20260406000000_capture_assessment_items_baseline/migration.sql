-- Capture the previously applied AssessmentItem/MetricType schema
-- so Prisma migration history matches the current database state.

CREATE TYPE "MetricType" AS ENUM ('Percentage', 'Frequency', 'Duration', 'Subjective');

CREATE TABLE "AssessmentItem" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "metricType" "MetricType",
    "rawValue" DOUBLE PRECISION,
    "supportLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssessmentItem_entryId_idx" ON "AssessmentItem"("entryId");

ALTER TABLE "AssessmentItem"
ADD CONSTRAINT "AssessmentItem_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "Entry"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
