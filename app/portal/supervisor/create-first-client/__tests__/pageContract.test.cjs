/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const pageSource = fs.readFileSync(path.join(__dirname, "../page.tsx"), "utf8");

test("the first-client dashboard derives both required supervisor properties", () => {
  assert.match(pageSource, /email: true/);
  assert.match(pageSource, /status: true/);
  assert.match(
    pageSource,
    /organizationMemberships:[\s\S]*active: true[\s\S]*role: \{ in: \["OWNER", "ADMIN"\] \}/
  );
  assert.match(pageSource, /if \(!provider\) \{\s*redirect\("\/login"\);/);
  assert.match(
    pageSource,
    /deriveAdministrativePresentationCapabilities/
  );
  assert.match(
    pageSource,
    /administrativeCapabilities=\{administrativeCapabilities\}/
  );
  assert.match(
    pageSource,
    /recipientSupervisorId: session\.providerId,\s*status: "REQUESTED"/
  );
  assert.match(
    pageSource,
    /\.\.\.caseSupportNotificationAccessWhere\(session\.providerId\),\s*readAt: null/
  );
  assert.match(
    pageSource,
    /newCaseSupportRequestCount=\{\s*pendingCaseSupportRequestCount \+ unreadCaseSupportNotificationCount\s*\}/
  );
});

test("the first-client page fails legacy Client discovery closed", () => {
  assert.match(pageSource, /!session \|\| session\.role !== "Supervisor"/);
  assert.doesNotMatch(pageSource, /getManagedOrganizationIds|managedClientWhere/);
  assert.doesNotMatch(pageSource, /availableClients|addSupervisorClient/);
  assert.match(pageSource, /if \(clients\.length > 0\) \{\s*redirect\("\/dashboard"\);/);
  assert.match(pageSource, /<SupervisorDashboard/);
});
