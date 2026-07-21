-- AlterEnum
ALTER TYPE "public"."EntryKind" ADD VALUE 'SupervisorObservation';
ALTER TYPE "public"."EntryKind" ADD VALUE 'ClinicalNote';

-- CreateTable
CREATE TABLE "public"."TeamFocus" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamFocus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TeamFocus_clientId_isActive_idx" ON "public"."TeamFocus"("clientId", "isActive");

-- CreateIndex
CREATE INDEX "TeamFocus_authorId_idx" ON "public"."TeamFocus"("authorId");

-- CreateIndex
CREATE INDEX "TeamFocus_updatedAt_idx" ON "public"."TeamFocus"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TeamFocus_one_active_per_client_idx" ON "public"."TeamFocus"("clientId") WHERE "isActive" = true;

-- AddForeignKey
ALTER TABLE "public"."TeamFocus" ADD CONSTRAINT "TeamFocus_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TeamFocus" ADD CONSTRAINT "TeamFocus_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."Provider"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
