/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const originalTsLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const attachPolicy = require(path.join(root, "src/lib/clientAttachPolicy.ts"));
const duplicatePolicy = require(path.join(root, "src/lib/clientDuplicatePolicy.ts"));
const duplicatePolicySource = read("src/lib/clientDuplicatePolicy.ts");
const actions = read("app/actions/manageClientAttachRequests.ts");
const legacyActions = read("app/actions/manageSupervisorClients.ts");
const dashboardPage = read("app/dashboard/page.tsx");
const firstClientPage = read("app/portal/supervisor/create-first-client/page.tsx");
const duplicateDiscovery = read("src/lib/clientDuplicateDiscovery.ts");
const schema = read("prisma/schema.prisma");
const migration = read(
  "prisma/migrations/20260829150000_add_client_attach_requests/migration.sql"
);

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

function membership(overrides = {}) {
  return {
    providerId: "provider-a",
    organizationId: "organization-a",
    role: "ADMIN",
    active: true,
    ...overrides,
  };
}

test("valid direct organization administrators can request attachment", () => {
  assert.equal(
    attachPolicy.canCreateClientAttachRequest({
      actorId: "provider-a",
      organizationId: "organization-a",
      providerStatus: "ACTIVE",
      membership: membership(),
      organizationParticipates: false,
      pendingRequestExists: false,
    }),
    true
  );
  assert.deepEqual(
    attachPolicy.directAttachAdministratorWhere(
      "provider-a",
      "organization-a"
    ),
    {
      providerId: "provider-a",
      organizationId: "organization-a",
      active: true,
      role: { in: ["OWNER", "ADMIN"] },
      provider: { status: "ACTIVE" },
    }
  );
});

test("ordinary, inactive, and different-organization members are denied", () => {
  const base = {
    actorId: "provider-a",
    organizationId: "organization-a",
    providerStatus: "ACTIVE",
    organizationParticipates: false,
    pendingRequestExists: false,
  };
  assert.equal(
    attachPolicy.canCreateClientAttachRequest({
      ...base,
      membership: membership({ role: "MEMBER" }),
    }),
    false
  );
  assert.equal(
    attachPolicy.canCreateClientAttachRequest({
      ...base,
      membership: membership({ active: false }),
    }),
    false
  );
  assert.equal(
    attachPolicy.canCreateClientAttachRequest({
      ...base,
      membership: membership({ organizationId: "organization-b" }),
    }),
    false
  );
});

test("school and district hierarchy never supplies inherited attach authority", () => {
  const where = attachPolicy.directAttachAdministratorWhere(
    "provider-a",
    "school-a"
  );
  assert.equal(where.organizationId, "school-a");
  assert.doesNotMatch(JSON.stringify(where), /parentOrganization|childOrganizations/);
  assert.doesNotMatch(actions, /parentOrganization|childOrganizations/);
});

test("valid and invalid case-code outcomes share one non-disclosing response", () => {
  const first = attachPolicy.genericClientAttachResponse();
  const second = attachPolicy.genericClientAttachResponse();
  assert.deepEqual(first, second);
  assert.equal(
    first.message,
    "If the case code is valid and eligible, the request will be reviewed."
  );
  assert.match(actions, /where: \{ caseCode: submittedCaseCode \}/);
  assert.match(actions, /CASE_CODE_NOT_FOUND/);
  assert.match(actions, /ALREADY_PARTICIPATING/);
  assert.match(actions, /PENDING_REQUEST_EXISTS/);
  assert.doesNotMatch(
    actions,
    /select:\s*\{[^}]*firstName|select:\s*\{[^}]*dateOfBirth|select:\s*\{[^}]*diagnosis/
  );
});

test("case-code possession creates neither Client access nor provider assignment", () => {
  const requestSection = actions.slice(
    actions.indexOf("export async function requestExistingClientAttachment"),
    actions.indexOf("async function decideClientAttachRequest")
  );
  assert.doesNotMatch(requestSection, /providerClient\.(create|update|upsert)/);
  assert.doesNotMatch(requestSection, /clientTeamManager\.(create|update|upsert)/);
  assert.match(requestSection, /organizationMembership\.findFirst/);
  assert.match(requestSection, /canCreateClientAttachRequest/);
});

test("pending uniqueness and serializable actions close concurrent request races", () => {
  assert.match(
    migration,
    /ClientAttachRequest_one_pending_per_client_organization[\s\S]*WHERE "status" = 'PENDING'/
  );
  assert.match(actions, /status: "PENDING"/);
  assert.match(actions, /isolationLevel: "Serializable"/);
  assert.doesNotMatch(actions, /clientAttachRequest\.delete/);
  assert.match(migration, /ClientAttachRequest_historical_retention/);
  assert.match(migration, /terminal decisions are immutable/);
});

test("only an active exact Client Team Manager can approve or reject", () => {
  const allowed = attachPolicy.canDecideClientAttachRequest({
    actorId: "manager-a",
    clientId: "client-a",
    providerStatus: "ACTIVE",
    assignment: {
      providerId: "manager-a",
      clientId: "client-a",
      revokedAt: null,
    },
    teamManager: {
      providerId: "manager-a",
      clientId: "client-a",
      revokedAt: null,
    },
  });
  assert.equal(allowed, true);
  assert.equal(
    attachPolicy.canDecideClientAttachRequest({
      actorId: "manager-a",
      clientId: "client-a",
      providerStatus: "ACTIVE",
      assignment: {
        providerId: "manager-a",
        clientId: "client-a",
        revokedAt: null,
      },
      teamManager: null,
    }),
    false
  );
  assert.match(actions, /activeClientAssignmentWhere\(actor\.id, request\.clientId\)/);
  assert.match(actions, /activeClientTeamManagerWhere\(actor\.id, request\.clientId\)/);
});

test("approval atomically activates participation without assigning a provider", () => {
  const decisionSection = actions.slice(
    actions.indexOf("async function decideClientAttachRequest"),
    actions.indexOf("export async function approveClientAttachRequest")
  );
  assert.match(decisionSection, /clientAttachRequest\.updateMany/);
  assert.match(decisionSection, /status: "PENDING"/);
  assert.match(decisionSection, /clientOrganization\.upsert/);
  assert.match(decisionSection, /role: "PARTICIPATING"/);
  assert.match(decisionSection, /status: "ACTIVE"/);
  assert.match(decisionSection, /approvedById: actor\.id/);
  assert.match(decisionSection, /ATTACH_APPROVED/);
  assert.match(decisionSection, /ATTACH_REJECTED/);
  assert.doesNotMatch(decisionSection, /providerClient\.(create|update|upsert)/);
  assert.doesNotMatch(decisionSection, /clientTeamManager\.(create|update|upsert)/);
});

test("only the original requesting administrator can cancel a pending request", () => {
  const allowed = attachPolicy.canCancelClientAttachRequest({
    actorId: "provider-a",
    organizationId: "organization-a",
    requestedById: "provider-a",
    providerStatus: "ACTIVE",
    membership: membership(),
  });
  assert.equal(allowed, true);
  assert.equal(
    attachPolicy.canCancelClientAttachRequest({
      actorId: "provider-b",
      organizationId: "organization-a",
      requestedById: "provider-a",
      providerStatus: "ACTIVE",
      membership: membership({ providerId: "provider-b" }),
    }),
    false
  );
  assert.match(actions, /status: "CANCELLED"/);
  assert.match(actions, /ATTACH_CANCELLED/);
});

test("durable actor-and-organization rate limiting is atomic and fails closed", () => {
  assert.match(schema, /model ClientAttachRateLimitBucket/);
  assert.match(
    schema,
    /@@unique\(\[providerId, organizationId, bucketStartedAt\]\)/
  );
  assert.match(actions, /ON CONFLICT \("providerId", "organizationId", "bucketStartedAt"\)/);
  assert.match(actions, /attemptCount[\s\S]*CLIENT_ATTACH_RATE_LIMIT/);
  assert.match(actions, /RATE_LIMITED/);
  assert.match(actions, /FAILED_CLOSED/);
  assert.match(actions, /bestEffortSecurityAudit/);
  assert.match(actions, /error\.code === "P2002"/);
  const rateLimitTable = migration.match(
    /CREATE TABLE "ClientAttachRateLimitBucket" \([\s\S]*?\n\);/
  )[0];
  assert.doesNotMatch(rateLimitTable, /caseCode|attemptedCode|plaintext/i);
});

test("security outcomes are precise internally but contain no attempted case code", () => {
  for (const outcome of [
    "REQUEST_CREATED",
    "CASE_CODE_NOT_FOUND",
    "ALREADY_PARTICIPATING",
    "PENDING_REQUEST_EXISTS",
    "UNAUTHORIZED",
    "RATE_LIMITED",
    "FAILED_CLOSED",
  ]) {
    assert.match(schema, new RegExp(outcome));
  }
  assert.match(migration, /ClientAttachSecurityEvent_append_only/);
  assert.doesNotMatch(
    schema.match(/model ClientAttachSecurityEvent \{[\s\S]*?\n\}/)[0],
    /caseCode|payload|metadata/
  );
});

test("possible duplicate discovery requires DOB and stays inside active assignment scope", () => {
  assert.equal(
    duplicatePolicy.possibleDuplicateDiscoveryScope("provider-a", {
      firstName: "Same",
      lastName: "Name",
      dateOfBirth: null,
    }),
    null
  );
  const dateOfBirth = new Date("2015-01-02T00:00:00.000Z");
  const scope = duplicatePolicy.possibleDuplicateDiscoveryScope("provider-a", {
    firstName: " Same ",
    lastName: " Name ",
    dateOfBirth,
  });
  assert.equal(scope.dateOfBirth, dateOfBirth);
  assert.equal(scope.providerId, "provider-a");
  assert.match(duplicateDiscovery, /assignment\."revokedAt" IS NULL/);
  assert.match(duplicateDiscovery, /membership\."id" IS NOT NULL/);
  assert.match(duplicateDiscovery, /participation\."id" IS NOT NULL/);
  assert.match(duplicateDiscovery, /LIMIT \$\{POSSIBLE_DUPLICATE_LIMIT\}/);
  assert.doesNotMatch(duplicateDiscovery, /organizationMembership|managedClientWhere/);
});

test("duplicate policy warns only and never merges or blocks creation", () => {
  const createAction = read("app/actions/createClientWithProviders.ts");
  assert.doesNotMatch(
    duplicateDiscovery + createAction,
    /mergeClient|client\.updateMany|client\.delete|client\.deleteMany/
  );
  assert.match(duplicateDiscovery, /return db\.\$queryRaw/);
  assert.match(duplicatePolicySource, /POSSIBLE_DUPLICATE_LIMIT/);
});

test("legacy Link Client no longer discovers Clients or self-assigns administrators", () => {
  const legacyAdd = legacyActions.slice(
    legacyActions.indexOf("export async function addSupervisorClient"),
    legacyActions.indexOf("export async function updateClientAssignments")
  );
  assert.match(legacyAdd, /Legacy Link Client is unavailable/);
  assert.doesNotMatch(legacyAdd, /providerClient\.(create|update|upsert)/);
  assert.doesNotMatch(
    dashboardPage,
    /managedClientWhere|availableClients|addSupervisorClient/
  );
  assert.doesNotMatch(
    firstClientPage,
    /managedClientWhere|availableClients|addSupervisorClient/
  );
});

test("the migration is additive, historical, and PostgreSQL 17/18 compatible", () => {
  assert.match(migration, /CREATE TABLE "ClientAttachRequest"/);
  assert.match(migration, /CREATE TABLE "ClientAttachRateLimitBucket"/);
  assert.match(migration, /CREATE TABLE "ClientAttachSecurityEvent"/);
  assert.match(migration, /ON DELETE RESTRICT/);
  assert.match(migration, /reason_length_check/);
  assert.doesNotMatch(migration, /DROP TABLE|DROP COLUMN|DELETE FROM|UPDATE "Client"/);
  assert.doesNotMatch(migration, /MERGE INTO/);
});
