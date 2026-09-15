-- CreateEnum
CREATE TYPE "AgencyAccessRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- CreateTable
CREATE TABLE "AgencyAccessRequest" (
    "id" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "normalizedOrganization" TEXT NOT NULL,
    "organizationType" "OrganizationType" NOT NULL,
    "contactFirstName" TEXT NOT NULL,
    "contactLastName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "normalizedEmail" TEXT NOT NULL,
    "status" "AgencyAccessRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedAt" TIMESTAMP(3),
    "reviewedByProviderId" TEXT,
    "approvedOrganizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgencyAccessRequest_status_createdAt_idx" ON "AgencyAccessRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AgencyAccessRequest_normalizedEmail_status_idx" ON "AgencyAccessRequest"("normalizedEmail", "status");

-- CreateIndex
CREATE INDEX "AgencyAccessRequest_normalizedOrganization_status_idx" ON "AgencyAccessRequest"("normalizedOrganization", "status");

-- AddForeignKey
ALTER TABLE "AgencyAccessRequest" ADD CONSTRAINT "AgencyAccessRequest_reviewedByProviderId_fkey" FOREIGN KEY ("reviewedByProviderId") REFERENCES "Provider"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyAccessRequest" ADD CONSTRAINT "AgencyAccessRequest_approvedOrganizationId_fkey" FOREIGN KEY ("approvedOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
