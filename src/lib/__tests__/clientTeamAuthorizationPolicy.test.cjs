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

const policy = require(path.join(
  process.cwd(),
  "src/lib/clientTeamAuthorizationPolicy.ts"
));

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

test("active Client access requires an unrevoked assignment and an active provider", () => {
  const where = policy.activeClientAssignmentWhere("provider-a", "client-a");

  assert.equal(where.providerId, "provider-a");
  assert.equal(where.clientId, "client-a");
  assert.equal(where.revokedAt, null);
  assert.deepEqual(where.provider, { status: "ACTIVE" });
});

test("organization-backed access requires both active membership and active Client participation", () => {
  const where = policy.activeClientAssignmentWhere("provider-a", "client-a");
  const organizationBacked = where.OR.find((branch) => branch.organization);

  assert.deepEqual(
    organizationBacked.organization.memberships.some,
    { providerId: "provider-a", active: true }
  );
  assert.deepEqual(
    organizationBacked.organization.clientOrganizations.some,
    {
      clientId: "client-a",
      status: "ACTIVE",
      revokedAt: null,
    }
  );
});

test("organization membership alone never creates Client access", () => {
  const membership = policy.activeOrganizationMembershipWhere(
    "provider-a",
    "organization-a"
  );
  const access = policy.activeClientAssignmentWhere("provider-a", "client-a");

  assert.equal(membership.providerId, "provider-a");
  assert.equal(membership.active, true);
  assert.equal(access.providerId, "provider-a");
  assert.equal(access.clientId, "client-a");
  assert.equal(Object.hasOwn(membership, "clientId"), false);
});

test("Team Manager authority is client-specific and depends on active Client access", () => {
  const manager = policy.activeClientTeamManagerWhere("manager-a", "client-a");

  assert.equal(manager.providerId, "manager-a");
  assert.equal(manager.clientId, "client-a");
  assert.equal(manager.revokedAt, null);
  assert.equal(
    manager.client.providerClients.some.clientId,
    "client-a"
  );
  assert.equal(
    manager.client.providerClients.some.providerId,
    "manager-a"
  );
});

test("pending and revoked Client organizations cannot supply providers", () => {
  assert.deepEqual(
    policy.activeClientOrganizationWhere("client-a", "organization-a"),
    {
      clientId: "client-a",
      organizationId: "organization-a",
      status: "ACTIVE",
      revokedAt: null,
    }
  );
});

test("provider eligibility requires active status, active membership, organization, and role", () => {
  const where = policy.eligibleProviderWhere(
    "provider-a",
    "organization-a"
  );

  assert.deepEqual(where, {
    id: "provider-a",
    status: "ACTIVE",
    role: { in: policy.CLIENT_ASSIGNMENT_ROLES },
    organizationMemberships: {
      some: { organizationId: "organization-a", active: true },
    },
  });
  assert.equal(policy.isEligibleClientAssignmentRole("Supervisor"), false);
  assert.equal(policy.isEligibleClientAssignmentRole("BehaviorTherapist"), true);
});

test("school hierarchy grants no inherited authority", () => {
  assert.equal(policy.isValidOrganizationParent("SCHOOL", "DISTRICT"), true);
  assert.equal(policy.isValidOrganizationParent("SCHOOL", "AGENCY"), false);
  assert.equal(policy.isValidOrganizationParent("AGENCY", "DISTRICT"), false);

  const access = policy.activeClientAssignmentWhere("provider-a", "client-a");
  assert.doesNotMatch(JSON.stringify(access), /parentOrganization/);
});

test("audit metadata is bounded and rejects oversized values", () => {
  assert.deepEqual(policy.boundedClientTeamAuditMetadata({ reason: "reviewed" }), {
    reason: "reviewed",
  });
  assert.throws(
    () => policy.boundedClientTeamAuditMetadata({ reason: "x".repeat(257) }),
    /oversized/
  );
  assert.throws(
    () =>
      policy.boundedClientTeamAuditMetadata(
        Object.fromEntries(Array.from({ length: 13 }, (_, index) => [`k${index}`, index]))
      ),
    /too many/
  );
});

test("schema and SQL enforce uniqueness without deleting legacy relationships", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "prisma/schema.prisma"),
    "utf8"
  );
  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      "prisma/migrations/20260824090000_add_multi_organization_client_team_foundation/migration.sql"
    ),
    "utf8"
  );

  assert.match(schema, /caseCode\s+String\s+@unique\s+@default\(uuid\(\)\)/);
  assert.match(schema, /@@unique\(\[providerId, clientId\]\)/);
  assert.match(migration, /HAVING COUNT\(\*\) > 1/);
  assert.match(migration, /ClientOrganization_one_active_lead_per_client/);
  assert.match(migration, /WHERE "role" = 'LEAD'[\s\S]*"status" = 'ACTIVE'/);
  assert.match(migration, /ClientTeamAuditEvent_append_only/);
  assert.match(migration, /pg_column_size\("metadata"\) <= 4096/);
  assert.doesNotMatch(migration, /DELETE FROM "ProviderClient"/);
  assert.doesNotMatch(migration, /DELETE FROM "Entry"/);
});

test("revocation fields do not cascade into historical clinical records", () => {
  const schema = fs.readFileSync(
    path.join(process.cwd(), "prisma/schema.prisma"),
    "utf8"
  );
  const providerClient = schema.match(/model ProviderClient \{[\s\S]*?\n\}/)[0];
  const entry = schema.match(/model Entry \{[\s\S]*?\n\}/)[0];

  assert.match(providerClient, /revokedAt\s+DateTime\?/);
  assert.match(providerClient, /revokedById\s+String\?/);
  assert.doesNotMatch(entry, /ProviderClient/);
});
