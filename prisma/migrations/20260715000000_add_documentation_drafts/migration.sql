CREATE TABLE "DocumentationDraft" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "workflowKey" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DocumentationDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DocumentationDraft_providerId_clientId_workflowKey_key"
  ON "DocumentationDraft"("providerId", "clientId", "workflowKey");

CREATE INDEX "DocumentationDraft_clientId_providerId_idx"
  ON "DocumentationDraft"("clientId", "providerId");

CREATE INDEX "DocumentationDraft_updatedAt_idx"
  ON "DocumentationDraft"("updatedAt");

ALTER TABLE "DocumentationDraft"
  ADD CONSTRAINT "DocumentationDraft_providerId_fkey"
  FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DocumentationDraft"
  ADD CONSTRAINT "DocumentationDraft_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "Client"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
