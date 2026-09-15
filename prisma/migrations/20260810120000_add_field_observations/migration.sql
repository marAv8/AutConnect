-- CreateEnum
CREATE TYPE "FieldObservationRating" AS ENUM ('IMPLEMENTED', 'PARTIALLY_IMPLEMENTED', 'NOT_IMPLEMENTED', 'NOT_OBSERVED');

-- CreateEnum
CREATE TYPE "FieldObservationSetting" AS ENUM ('CLINIC', 'HOME', 'SCHOOL', 'COMMUNITY', 'TELEHEALTH', 'OTHER');

-- CreateTable
CREATE TABLE "FieldObservation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "supervisorId" TEXT NOT NULL,
    "observedProviderId" TEXT NOT NULL,
    "observedProviderRole" "Role" NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "setting" "FieldObservationSetting" NOT NULL,
    "durationMinutes" INTEGER,
    "rubricVersion" TEXT NOT NULL,
    "fidelityPercent" INTEGER NOT NULL,
    "applicableItemCount" INTEGER NOT NULL,
    "strengths" TEXT,
    "coachingFocus" TEXT,
    "followUp" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldObservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldObservationItem" (
    "id" TEXT NOT NULL,
    "fieldObservationId" TEXT NOT NULL,
    "criterionKey" TEXT NOT NULL,
    "criterionLabel" TEXT NOT NULL,
    "rating" "FieldObservationRating" NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "FieldObservationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FieldObservation_clientId_observedAt_idx" ON "FieldObservation"("clientId", "observedAt");

-- CreateIndex
CREATE INDEX "FieldObservation_supervisorId_observedAt_idx" ON "FieldObservation"("supervisorId", "observedAt");

-- CreateIndex
CREATE INDEX "FieldObservation_observedProviderId_observedAt_idx" ON "FieldObservation"("observedProviderId", "observedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FieldObservationItem_fieldObservationId_criterionKey_key" ON "FieldObservationItem"("fieldObservationId", "criterionKey");

-- CreateIndex
CREATE INDEX "FieldObservationItem_fieldObservationId_displayOrder_idx" ON "FieldObservationItem"("fieldObservationId", "displayOrder");

-- AddForeignKey
ALTER TABLE "FieldObservation" ADD CONSTRAINT "FieldObservation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldObservation" ADD CONSTRAINT "FieldObservation_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldObservation" ADD CONSTRAINT "FieldObservation_observedProviderId_fkey" FOREIGN KEY ("observedProviderId") REFERENCES "Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldObservationItem" ADD CONSTRAINT "FieldObservationItem_fieldObservationId_fkey" FOREIGN KEY ("fieldObservationId") REFERENCES "FieldObservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
