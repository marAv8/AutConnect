CREATE INDEX "Provider_createdAt_idx" ON "Provider"("createdAt");

CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

CREATE INDEX "ProviderClient_providerId_idx" ON "ProviderClient"("providerId");
CREATE INDEX "ProviderClient_clientId_idx" ON "ProviderClient"("clientId");
CREATE INDEX "ProviderClient_providerId_clientId_idx" ON "ProviderClient"("providerId", "clientId");

CREATE INDEX "Entry_clientId_date_idx" ON "Entry"("clientId", "date");
CREATE INDEX "Entry_clientId_providerId_date_idx" ON "Entry"("clientId", "providerId", "date");
CREATE INDEX "Entry_date_idx" ON "Entry"("date");

CREATE INDEX "AssessmentItem_entryId_idx" ON "AssessmentItem"("entryId");
CREATE INDEX "AssessmentItem_goalId_idx" ON "AssessmentItem"("goalId");

CREATE INDEX "GoalDefinition_clientId_providerId_isActive_isMastered_idx" ON "GoalDefinition"("clientId", "providerId", "isActive", "isMastered");
CREATE INDEX "GoalDefinition_providerId_idx" ON "GoalDefinition"("providerId");

CREATE INDEX "EntryRead_providerId_entryId_idx" ON "EntryRead"("providerId", "entryId");
