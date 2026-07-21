-- CreateEnum
CREATE TYPE "public"."EntryKind" AS ENUM ('SessionNote', 'MorningContext', 'EveningContext');

-- AlterTable
ALTER TABLE "public"."Client"
ADD COLUMN "receivesPrescribedMedication" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Entry"
ADD COLUMN "kind" "public"."EntryKind" NOT NULL DEFAULT 'SessionNote',
ADD COLUMN "contextData" JSONB;

-- DropIndex
DROP INDEX "public"."Entry_providerId_clientId_date_key";

-- CreateIndex
CREATE UNIQUE INDEX "Entry_providerId_clientId_date_kind_key" ON "public"."Entry"("providerId", "clientId", "date", "kind");

-- CreateIndex
CREATE INDEX "Entry_clientId_kind_date_idx" ON "public"."Entry"("clientId", "kind", "date");
