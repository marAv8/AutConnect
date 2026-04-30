/*
  Warnings:

  - Made the column `metricType` on table `AssessmentItem` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "public"."ComparisonType" AS ENUM ('LessThan', 'GreaterThan', 'Equal');

-- DropIndex
DROP INDEX "public"."AssessmentItem_entryId_idx";

-- AlterTable
ALTER TABLE "public"."AssessmentItem" ADD COLUMN     "goalId" TEXT,
ALTER COLUMN "score" DROP NOT NULL,
ALTER COLUMN "metricType" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."Entry" ADD COLUMN     "finalScore" INTEGER;

-- CreateTable
CREATE TABLE "public"."GoalDefinition" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "metricType" "public"."MetricType" NOT NULL,
    "targetValue" DOUBLE PRECISION,
    "comparison" "public"."ComparisonType",
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMastered" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoalDefinition_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "public"."AssessmentItem" ADD CONSTRAINT "AssessmentItem_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "public"."GoalDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GoalDefinition" ADD CONSTRAINT "GoalDefinition_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."GoalDefinition" ADD CONSTRAINT "GoalDefinition_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "public"."Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
