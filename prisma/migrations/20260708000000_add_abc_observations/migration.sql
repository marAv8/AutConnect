CREATE TABLE "public"."AbcObservation" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "antecedent" TEXT NOT NULL,
    "behavior" TEXT NOT NULL,
    "consequence" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AbcObservation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AbcObservation_entryId_idx" ON "public"."AbcObservation"("entryId");
CREATE INDEX "AbcObservation_createdAt_idx" ON "public"."AbcObservation"("createdAt");

ALTER TABLE "public"."AbcObservation" ADD CONSTRAINT "AbcObservation_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "public"."Entry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
