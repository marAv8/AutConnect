/*
  Warnings:

  - The primary key for the `ProviderClient` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The required column `id` was added to the `ProviderClient` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - Added the required column `role` to the `ProviderClient` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('Supervisor', 'Educator', 'SpeechPathologist', 'Caregiver', 'BehaviorTherapist', 'OccupationalTherapist');

-- AlterTable
ALTER TABLE "public"."Client" ADD COLUMN     "dateOfBirth" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "public"."ProviderClient" DROP CONSTRAINT "ProviderClient_pkey",
ADD COLUMN     "id" TEXT NOT NULL,
ADD COLUMN     "role" "public"."Role" NOT NULL,
ADD CONSTRAINT "ProviderClient_pkey" PRIMARY KEY ("id");
