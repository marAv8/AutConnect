/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const originalTsLoader = require.extensions[".ts"];
require.extensions[".ts"] = (module, filename) => {
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

const { deriveAdministrativePresentationCapabilities } = require(
  path.join(root, "app/dashboard/administrativeCapabilities.ts")
);

test.after(() => {
  require.extensions[".ts"] = originalTsLoader;
});

function capabilities(overrides = {}) {
  return deriveAdministrativePresentationCapabilities({
    providerRole: "Supervisor",
    sessionRole: "Supervisor",
    providerStatus: "ACTIVE",
    isPlatformAdministrator: false,
    administeredOrganizationIds: [],
    assignedClientIds: [],
    teamManagedClientIds: [],
    ...overrides,
  });
}

test("ordinary assigned Supervisor sees self-removal but no administrative grant actions", () => {
  const result = capabilities({ assignedClientIds: ["client-a"] });

  assert.equal(result.canInviteTeam, false);
  assert.equal(result.canAddClient, false);
  assert.equal(result.canAttachExistingClient, false);
  assert.equal(result.canReviewOrganizationInvitations, false);
  assert.deepEqual(result.removableClientIds, ["client-a"]);
  assert.deepEqual(result.careTeamClientIds, []);
});

test("direct organization administrator Supervisor receives only organization-scoped entry points", () => {
  const result = capabilities({
    administeredOrganizationIds: ["organization-administered"],
  });

  assert.equal(result.canInviteTeam, true);
  assert.equal(result.canAddClient, true);
  assert.equal(result.canAttachExistingClient, true);
  assert.equal(result.canReviewOrganizationInvitations, true);
});

test("Client Team Manager authority does not imply unrelated organization authority", () => {
  const result = capabilities({
    assignedClientIds: ["client-a"],
    teamManagedClientIds: ["client-a"],
  });

  assert.deepEqual(result.careTeamClientIds, ["client-a"]);
  assert.equal(result.canInviteTeam, false);
  assert.equal(result.canAddClient, false);
  assert.equal(result.canAttachExistingClient, false);
});

test("organization administrator without Client assignment gets organization actions but no Client actions", () => {
  const result = capabilities({
    providerRole: "Educator",
    sessionRole: "Educator",
    administeredOrganizationIds: ["organization-a"],
  });

  assert.equal(result.canInviteTeam, true);
  assert.equal(result.canAddClient, false);
  assert.equal(result.canAttachExistingClient, true);
  assert.equal(result.canReviewOrganizationInvitations, true);
  assert.deepEqual(result.removableClientIds, []);
  assert.deepEqual(result.careTeamClientIds, []);
});

test("ordinary organization membership and lead relationship confer no presentation authority", () => {
  const result = capabilities({
    membershipOrganizationIds: ["organization-member"],
    leadOrganizationIds: ["organization-lead"],
  });

  assert.equal(result.canInviteTeam, false);
  assert.equal(result.canAddClient, false);
  assert.equal(result.canAttachExistingClient, false);
  assert.equal(result.canReviewOrganizationInvitations, false);
  assert.equal(result.canLinkClient, false);
});

test("administering one of several memberships does not broaden the capability input", () => {
  const result = capabilities({
    administeredOrganizationIds: ["organization-administered"],
    membershipOrganizationIds: [
      "organization-administered",
      "organization-member-only",
    ],
  });

  assert.equal(result.canAddClient, true);
  assert.equal("organizationIds" in result, false);
  assert.equal("membershipOrganizationIds" in result, false);
});

test("Care Team requires both exact manager authority and current assignment", () => {
  const result = capabilities({
    assignedClientIds: ["client-assigned"],
    teamManagedClientIds: ["client-assigned", "client-unassigned"],
  });

  assert.deepEqual(result.careTeamClientIds, ["client-assigned"]);
});

test("inactive Provider or mismatched session role receives no capabilities", () => {
  for (const override of [
    { providerStatus: "INACTIVE" },
    { sessionRole: "Educator" },
  ]) {
    const result = capabilities({
      ...override,
      isPlatformAdministrator: true,
      administeredOrganizationIds: ["organization-a"],
      assignedClientIds: ["client-a"],
      teamManagedClientIds: ["client-a"],
    });
    assert.deepEqual(result, {
      canAccessPlatformAdministration: false,
      canInviteTeam: false,
      canAddClient: false,
      canAttachExistingClient: false,
      canReviewOrganizationInvitations: false,
      canLinkClient: false,
      removableClientIds: [],
      careTeamClientIds: [],
    });
  }
});

test("Dashboard derives booleans and scoped Client IDs from direct trusted predicates", () => {
  const dashboard = read("app/dashboard/page.tsx");
  const header = read("app/components/AppUserHeader.tsx");
  const menu = read("app/dashboard/SupervisorDashboardMenu.tsx");

  assert.match(
    dashboard,
    /organizationMemberships:[\s\S]*active: true[\s\S]*role: \{ in: \["OWNER", "ADMIN"\] \}/
  );
  assert.doesNotMatch(dashboard, /parentOrganization|childOrganizations/);
  assert.doesNotMatch(header, /organizationMemberships|clientOrganization\.count/);
  assert.match(dashboard, /hasActiveClientTeamManagerAuthority/);
  assert.match(dashboard, /deriveAdministrativePresentationCapabilities/);
  assert.match(menu, /administrativeCapabilities\.canInviteTeam/);
  assert.match(menu, /administrativeCapabilities\.canAddClient/);
  assert.match(menu, /administrativeCapabilities\.canAttachExistingClient/);
  assert.match(menu, /administrativeCapabilities\.careTeamClientIds\.includes/);
  assert.match(menu, /administrativeCapabilities\.removableClientIds\.length/);
});

test("direct routes and server actions retain their independent authorization boundaries", () => {
  const invitePage = read("app/portal/supervisor/invitations/page.tsx");
  const inviteAction = read("app/actions/manageOrganizationInvitations.ts");
  const createPage = read("app/portal/supervisor/create-client/page.tsx");
  const createAction = read("app/actions/createClientWithProviders.ts");
  const attachPage = read("app/portal/organization/attach-client/page.tsx");
  const attachAction = read("app/actions/manageClientAttachRequests.ts");
  const careTeamPage = read(
    "app/portal/supervisor/edit-providers/[clientId]/page.tsx"
  );
  const supervisorActions = read("app/actions/manageSupervisorClients.ts");

  for (const source of [invitePage, inviteAction]) {
    assert.match(source, /requireCurrentProvider/);
    assert.match(source, /getManagedOrganizationIds/);
  }
  for (const source of [createPage, createAction]) {
    assert.match(source, /requireCurrentSupervisor/);
    assert.match(source, /getManagedOrganizationIds/);
  }
  assert.match(attachPage, /active: true[\s\S]*role: \{ in: \["OWNER", "ADMIN"\] \}/);
  assert.match(attachAction, /canCreateClientAttachRequest/);
  assert.match(careTeamPage, /hasActiveClientTeamManagerAuthority/);
  assert.match(supervisorActions, /requireCurrentSupervisor/);
  assert.match(supervisorActions, /revokedAt: null/);
  assert.match(supervisorActions, /Legacy Link Client is unavailable/);
});

test("capability derivation carries no organization, Provider, or Client detail disclosure", () => {
  const source = read("app/dashboard/administrativeCapabilities.ts");

  assert.doesNotMatch(
    source,
    /firstName|lastName|email|caseCode|entries|measurements|goalDefinitions/
  );
  assert.doesNotMatch(source, /providerIds|organizationNames|clientNames/);
  assert.match(source, /canLinkClient: false/);
});
