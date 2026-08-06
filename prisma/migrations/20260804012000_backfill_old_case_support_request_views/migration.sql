UPDATE "CaseSupportRequest"
SET "requesterViewedAt" = "updatedAt"
WHERE "requesterViewedAt" IS NULL
  AND "updatedAt" < CURRENT_TIMESTAMP - INTERVAL '30 days';
