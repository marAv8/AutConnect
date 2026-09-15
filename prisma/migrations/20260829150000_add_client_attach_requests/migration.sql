-- Phase 3A secure Attach Existing Client foundation.
-- Additive only: this migration creates lifecycle, rate-limit, and security-audit
-- storage. It does not inspect case codes, merge Clients, or backfill records.

ALTER TYPE "ClientTeamAuditAction" ADD VALUE 'ATTACH_REQUESTED';
ALTER TYPE "ClientTeamAuditAction" ADD VALUE 'ATTACH_APPROVED';
ALTER TYPE "ClientTeamAuditAction" ADD VALUE 'ATTACH_REJECTED';
ALTER TYPE "ClientTeamAuditAction" ADD VALUE 'ATTACH_CANCELLED';

CREATE TYPE "ClientAttachRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TYPE "ClientAttachSecurityOutcome" AS ENUM (
  'REQUEST_CREATED',
  'CASE_CODE_NOT_FOUND',
  'ALREADY_PARTICIPATING',
  'PENDING_REQUEST_EXISTS',
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'FAILED_CLOSED'
);

CREATE TABLE "ClientAttachRequest" (
  "id" TEXT NOT NULL,
  "clientId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "status" "ClientAttachRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "reason" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientAttachRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientAttachRequest_reason_length_check"
    CHECK ("reason" IS NULL OR char_length("reason") <= 256),
  CONSTRAINT "ClientAttachRequest_decision_consistency_check"
    CHECK (
      ("status" = 'PENDING' AND "decidedById" IS NULL AND "decidedAt" IS NULL)
      OR
      ("status" <> 'PENDING' AND "decidedById" IS NOT NULL AND "decidedAt" IS NOT NULL)
    )
);

CREATE INDEX "ClientAttachRequest_clientId_status_requestedAt_idx"
ON "ClientAttachRequest"("clientId", "status", "requestedAt");

CREATE INDEX "ClientAttachRequest_organizationId_status_requestedAt_idx"
ON "ClientAttachRequest"("organizationId", "status", "requestedAt");

CREATE INDEX "ClientAttachRequest_requestedById_status_requestedAt_idx"
ON "ClientAttachRequest"("requestedById", "status", "requestedAt");

-- Prisma cannot express partial uniqueness. This preserves historical terminal
-- requests while preventing concurrent duplicate pending requests.
CREATE UNIQUE INDEX "ClientAttachRequest_one_pending_per_client_organization"
ON "ClientAttachRequest"("clientId", "organizationId")
WHERE "status" = 'PENDING';

CREATE TABLE "ClientAttachRateLimitBucket" (
  "id" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "bucketStartedAt" TIMESTAMP(3) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ClientAttachRateLimitBucket_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClientAttachRateLimitBucket_attemptCount_check"
    CHECK ("attemptCount" > 0)
);

CREATE UNIQUE INDEX "ClientAttachRateLimitBucket_providerId_organizationId_bucketStartedAt_key"
ON "ClientAttachRateLimitBucket"("providerId", "organizationId", "bucketStartedAt");

-- Supports bounded retention cleanup without scanning the table.
CREATE INDEX "ClientAttachRateLimitBucket_bucketStartedAt_idx"
ON "ClientAttachRateLimitBucket"("bucketStartedAt");

CREATE TABLE "ClientAttachSecurityEvent" (
  "id" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "organizationId" TEXT,
  "requestId" TEXT,
  "outcome" "ClientAttachSecurityOutcome" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ClientAttachSecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClientAttachSecurityEvent_actorId_createdAt_idx"
ON "ClientAttachSecurityEvent"("actorId", "createdAt");

CREATE INDEX "ClientAttachSecurityEvent_organizationId_createdAt_idx"
ON "ClientAttachSecurityEvent"("organizationId", "createdAt");

CREATE INDEX "ClientAttachSecurityEvent_createdAt_idx"
ON "ClientAttachSecurityEvent"("createdAt");

ALTER TABLE "ClientAttachRequest"
ADD CONSTRAINT "ClientAttachRequest_clientId_fkey"
FOREIGN KEY ("clientId") REFERENCES "Client"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientAttachRequest"
ADD CONSTRAINT "ClientAttachRequest_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientAttachRequest"
ADD CONSTRAINT "ClientAttachRequest_requestedById_fkey"
FOREIGN KEY ("requestedById") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientAttachRequest"
ADD CONSTRAINT "ClientAttachRequest_decidedById_fkey"
FOREIGN KEY ("decidedById") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientAttachRateLimitBucket"
ADD CONSTRAINT "ClientAttachRateLimitBucket_providerId_fkey"
FOREIGN KEY ("providerId") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientAttachRateLimitBucket"
ADD CONSTRAINT "ClientAttachRateLimitBucket_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientAttachSecurityEvent"
ADD CONSTRAINT "ClientAttachSecurityEvent_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "Provider"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientAttachSecurityEvent"
ADD CONSTRAINT "ClientAttachSecurityEvent_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClientAttachSecurityEvent"
ADD CONSTRAINT "ClientAttachSecurityEvent_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "ClientAttachRequest"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "protect_client_attach_request_history"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ClientAttachRequest history cannot be deleted';
  END IF;
  IF OLD."status" <> 'PENDING' OR NEW."status" = 'PENDING' THEN
    RAISE EXCEPTION 'ClientAttachRequest terminal decisions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "ClientAttachRequest_historical_retention"
BEFORE UPDATE OR DELETE ON "ClientAttachRequest"
FOR EACH ROW
EXECUTE FUNCTION "protect_client_attach_request_history"();

CREATE FUNCTION "prevent_client_attach_security_event_mutation"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'ClientAttachSecurityEvent is append-only';
END;
$$;

CREATE TRIGGER "ClientAttachSecurityEvent_append_only"
BEFORE UPDATE OR DELETE ON "ClientAttachSecurityEvent"
FOR EACH ROW
EXECUTE FUNCTION "prevent_client_attach_security_event_mutation"();
