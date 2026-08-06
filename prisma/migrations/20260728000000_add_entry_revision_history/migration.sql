CREATE TABLE "public"."EntryRevision" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changes" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntryRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EntryRevision_entryId_revisionNumber_key"
ON "public"."EntryRevision"("entryId", "revisionNumber");

CREATE INDEX "EntryRevision_entryId_createdAt_idx"
ON "public"."EntryRevision"("entryId", "createdAt");

CREATE INDEX "EntryRevision_createdById_idx"
ON "public"."EntryRevision"("createdById");

ALTER TABLE "public"."EntryRevision"
ADD CONSTRAINT "EntryRevision_entryId_fkey"
FOREIGN KEY ("entryId") REFERENCES "public"."Entry"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."EntryRevision"
ADD CONSTRAINT "EntryRevision_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "public"."Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
