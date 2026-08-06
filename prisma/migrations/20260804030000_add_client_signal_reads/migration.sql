CREATE TABLE "public"."ClientSignalRead" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "sessionDate" TIMESTAMP(3) NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientSignalRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClientSignalRead_clientId_providerId_sessionDate_key"
ON "public"."ClientSignalRead"("clientId", "providerId", "sessionDate");

CREATE INDEX "ClientSignalRead_providerId_sessionDate_idx"
ON "public"."ClientSignalRead"("providerId", "sessionDate");

CREATE INDEX "ClientSignalRead_clientId_sessionDate_idx"
ON "public"."ClientSignalRead"("clientId", "sessionDate");

ALTER TABLE "public"."ClientSignalRead"
ADD CONSTRAINT "ClientSignalRead_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "public"."Client"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ClientSignalRead"
ADD CONSTRAINT "ClientSignalRead_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "public"."Provider"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
