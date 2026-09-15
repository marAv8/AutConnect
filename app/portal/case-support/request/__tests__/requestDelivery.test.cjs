/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const requestPageSource = fs.readFileSync(
  path.join(__dirname, "../[clientId]/page.tsx"),
  "utf8"
);
const requestCarouselSource = fs.readFileSync(
  path.join(__dirname, "../[clientId]/CaseSupportRequestCarousel.tsx"),
  "utf8"
);
const requestCarouselStyles = fs.readFileSync(
  path.join(__dirname, "../[clientId]/CaseSupportRequestCarousel.module.css"),
  "utf8"
);
const actionSource = fs.readFileSync(
  path.join(__dirname, "../../../../actions/manageCaseSupport.ts"),
  "utf8"
);
const orbitSource = fs.readFileSync(
  path.join(__dirname, "../../../../dashboard/ClientOrbit.tsx"),
  "utf8"
);
const dashboardSource = fs.readFileSync(
  path.join(__dirname, "../../../../dashboard/page.tsx"),
  "utf8"
);
const inboxSource = fs.readFileSync(
  path.join(__dirname, "../../requests/page.tsx"),
  "utf8"
);
const schemaSource = fs.readFileSync(
  path.join(__dirname, "../../../../../prisma/schema.prisma"),
  "utf8"
);
const migrationSource = fs.readFileSync(
  path.join(
    __dirname,
    "../../../../../prisma/migrations/20260814090000_add_case_support_request_details/migration.sql"
  ),
  "utf8"
);

test("the latest pending request takes precedence over an unrelated open case", () => {
  const requestStatusBranch = requestPageSource.indexOf("{latestRequest ? (");
  const requestEditorBranch = requestPageSource.indexOf(
    "<CaseSupportRequestCarousel",
    requestStatusBranch
  );

  assert.ok(requestStatusBranch >= 0);
  assert.ok(requestEditorBranch > requestStatusBranch);
  assert.match(
    requestPageSource,
    /accessibleCases\.some\([\s\S]*supportCase\.id === latestRequest\.linkedCase\?\.id/
  );
});

test("submission validates and persists the selected supervisor as a pending request only", () => {
  const start = actionSource.indexOf(
    "export async function submitCaseSupportRequest"
  );
  const end = actionSource.indexOf(
    "export async function acknowledgeCaseSupportRequest",
    start
  );
  const submission = actionSource.slice(start, end);

  assert.match(submission, /recipientSupervisorId: formData\.get/);
  assert.match(submission, /title: formData\.get\("title"\)/);
  assert.match(submission, /occurredAt: formData\.get\("occurredAt"\)/);
  assert.match(
    submission,
    /providerId: parsed\.data\.recipientSupervisorId/
  );
  assert.match(submission, /recipientSupervisorId: recipient\.providerId/);
  assert.match(submission, /title: parsed\.data\.title/);
  assert.match(submission, /occurredAt: parsed\.data\.occurredAt/);
  assert.match(submission, /linkedCaseId: null/);
  assert.match(submission, /status: "REQUESTED"/);
  assert.doesNotMatch(submission, /caseSupportCase\.(create|upsert)/);
  assert.doesNotMatch(submission, /caseSupportMember\.(create|upsert)/);
});

test("the provider request is a two-card carousel with the approved fields", () => {
  assert.match(requestPageSource, /<h1>Case Support<\/h1>/);
  assert.match(requestPageSource, />\s*Back\s*<\/Link>/);
  assert.match(requestCarouselSource, /activeCard \+ 1} of 2/);
  assert.match(requestCarouselSource, />Request details<\/h2>/);
  assert.match(requestCarouselSource, />Support needed<\/h2>/);
  for (const name of [
    "title",
    "occurredAt",
    "recipientSupervisorId",
    "concern",
    "requestedSupport",
  ]) {
    assert.match(requestCarouselSource, new RegExp(`name="${name}"`));
  }
  assert.match(requestCarouselSource, /minLength=\{3\}/);
  assert.match(requestCarouselSource, /maxLength=\{120\}/);
  assert.match(requestCarouselSource, /supervisors\.length === 1/);
  assert.match(requestCarouselSource, />\s*Send Request\s*<\/button>/);
  assert.match(requestCarouselStyles, /overflow-wrap: anywhere/);
  assert.match(requestCarouselStyles, /@media \(max-width: 620px\)/);
});

test("submitted requests replace the editor with one lifecycle status card", () => {
  const statusBranch = requestPageSource.indexOf("{latestRequest ? (");
  const carouselBranch = requestPageSource.indexOf(
    "<CaseSupportRequestCarousel",
    statusBranch
  );
  assert.ok(statusBranch >= 0);
  assert.ok(carouselBranch > statusBranch);
  assert.match(requestPageSource, /AWAITING REVIEW/);
  assert.match(requestPageSource, /ACKNOWLEDGED/);
  assert.match(requestPageSource, /CASE OPENED/);
  assert.match(requestPageSource, /SUPERVISOR RESPONSE/);
  assert.match(requestPageSource, /Open Active Case/);
  assert.doesNotMatch(requestPageSource, /CaseSupportSuccessToast/);
});

test("conversion uses submitted details and retains legacy fallbacks", () => {
  const start = actionSource.indexOf(
    "export async function convertCaseSupportRequest"
  );
  const end = actionSource.indexOf(
    "export async function viewCaseSupportRequestUpdate",
    start
  );
  const conversion = actionSource.slice(start, end);

  assert.match(
    conversion,
    /title: request\.title\?\.trim\(\) \|\| requestTitle\(request\.concern\)/
  );
  assert.match(conversion, /concern: request\.concern/);
  assert.match(conversion, /desiredOutcome: request\.requestedSupport/);
  assert.match(conversion, /occurredAt: request\.occurredAt\?\.toISOString\(\) \?\? null/);
  assert.doesNotMatch(
    conversion,
    /createdAt:\s*request\.occurredAt|updatedAt:\s*request\.occurredAt/
  );
});

test("open-case and new-request dashboard actions remain distinct", () => {
  assert.match(orbitSource, /"Open Active Case"/);
  assert.match(orbitSource, /label: "Request Case Support"/);
  assert.match(orbitSource, /`\/portal\/case-support\/\$\{client\.id\}`/);
  assert.match(
    orbitSource,
    /`\/portal\/case-support\/request\/\$\{client\.id\}`/
  );
  assert.doesNotMatch(
    orbitSource,
    /client\.canRequestCaseSupport === true\s*&&\s*!canOpenCaseSupport/
  );
});

test("the supervisor badge remains recipient-specific and counts requested records", () => {
  assert.match(dashboardSource, /recipientSupervisorId: session\.providerId/);
  assert.match(dashboardSource, /request\.status === "REQUESTED"/);
});

test("the request detail migration is nullable and limited to two columns", () => {
  assert.match(
    schemaSource,
    /model CaseSupportRequest[\s\S]*title\s+String\?[\s\S]*occurredAt\s+DateTime\?/
  );
  assert.match(migrationSource, /ADD COLUMN "title" TEXT/);
  assert.match(migrationSource, /ADD COLUMN "occurredAt" TIMESTAMP\(3\)/);
  assert.doesNotMatch(migrationSource, /NOT NULL|DROP|DELETE|UPDATE|CREATE TABLE/);
});

test("the supervisor inbox minimally exposes new request context", () => {
  assert.match(inboxSource, /request\.title\?\.trim\(\)/);
  assert.match(inboxSource, /request\.occurredAt/);
  assert.match(inboxSource, /requesterName/);
  assert.match(inboxSource, /clientCode/);
  assert.match(inboxSource, /request\.status/);
});
