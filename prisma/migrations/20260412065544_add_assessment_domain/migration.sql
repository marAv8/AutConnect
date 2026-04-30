-- CreateEnum
CREATE TYPE "public"."AssessmentDomain" AS ENUM ('Behavior', 'SkillAcquisition', 'Communication', 'Adaptive', 'Regulation', 'Other');

-- AlterTable
ALTER TABLE "public"."AssessmentItem" ADD COLUMN     "domain" "public"."AssessmentDomain";

-- AlterTable
ALTER TABLE "public"."GoalDefinition" ADD COLUMN     "domain" "public"."AssessmentDomain";
