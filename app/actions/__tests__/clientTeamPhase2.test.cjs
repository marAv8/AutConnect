/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const actions = read("app/actions/manageClientTeam.ts");
const teamPage = read("app/portal/supervisor/edit-providers/[clientId]/page.tsx");
const teamListPage = read("app/portal/supervisor/edit-providers/page.tsx");
const teamPanel = read("app/portal/supervisor/edit-providers/[clientId]/ClientTeamPanel.tsx");
const teamStyles = read("app/portal/supervisor/edit-providers/[clientId]/CareTeamPage.module.css");
const teamActionForm = read("app/portal/supervisor/edit-providers/[clientId]/ClientTeamActionForm.tsx");
const teamInfo = read("app/portal/supervisor/edit-providers/[clientId]/CareTeamInfo.tsx");
const invitationPage = read("app/portal/organization/client-invitations/page.tsx");
const invitationStyles = read("app/portal/organization/client-invitations/page.module.css");
const invitationInfo = read("app/portal/organization/client-invitations/InvitationInfo.tsx");
const appHeader = read("app/components/AppUserHeader.tsx");
const authenticatedHeader = read("app/components/AuthenticatedPageHeader.tsx");
const emptyDashboard = read("app/dashboard/FirstClientEmptyState.tsx");
const policy = read("src/lib/clientTeamAuthorizationPolicy.ts");
const supervisorActions = read("app/actions/manageSupervisorClients.ts");

test("Team Manager organization invitations are atomic, bounded, and concurrency-safe", () => {
  assert.match(actions, /requireCurrentProvider\(\)/);
  assert.match(actions, /requireTeamManager\(tx, actor\.id, clientId\)/);
  assert.match(actions, /role: "LEAD",[\s\S]*status: "ACTIVE",[\s\S]*revokedAt: null/);
  assert.match(actions, /lead\.organizationId === organizationId/);
  assert.match(actions, /status === "PENDING" \|\| existing\.status === "ACTIVE"/);
  assert.match(actions, /status: "REVOKED",[\s\S]*status: "PENDING"/);
  assert.match(actions, /transition: existing \? "REINVITED" : "INVITED"/);
  assert.match(actions, /isolationLevel: "Serializable"/);
  assert.match(actions, /take: SEARCH_CANDIDATE_LIMIT/);
  assert.match(actions, /AUTHORIZED_LOOKUP_RESULT_LIMIT/);
  assert.match(actions, /ORGANIZATION_REQUESTED/);
});

test("approval and rejection require exact active OWNER or ADMIN authority", () => {
  const decisionSource = actions.slice(
    actions.indexOf("async function decideClientOrganization"),
    actions.indexOf("export async function cancelClientOrganizationInvitation")
  );
  assert.match(actions, /organizationId: relationship\.organizationId/);
  assert.match(actions, /providerId: actor\.id,[\s\S]*active: true/);
  assert.match(actions, /role: \{ in: \["OWNER", "ADMIN"\] \}/);
  assert.doesNotMatch(
    decisionSource,
    /parentOrganization|childOrganizations/
  );
  assert.doesNotMatch(decisionSource, /providerClient\.(create|upsert|update)/);
  assert.match(actions, /updateMany\([\s\S]*status: "PENDING",[\s\S]*updated\.count !== 1/);
  assert.match(actions, /ORGANIZATION_APPROVED/);
  assert.match(actions, /transition: decision/);
});

test("pending invitation disclosure is minimal and contains no clinical fields", () => {
  assert.match(invitationPage, /caseCode: true/);
  assert.match(invitationPage, /requestedAt: true/);
  assert.match(invitationPage, /requestedBy:[\s\S]*firstName: true[\s\S]*lastName: true/);
  assert.match(
    invitationPage,
    /role: "LEAD"(?: as const)?, status: "ACTIVE"(?: as const)?, revokedAt: null/
  );
  assert.doesNotMatch(
    invitationPage,
    /entries|measurements|goalDefinitions|diagnosis|dateOfBirth|receivesPrescribedMedication|providerClients/
  );
  assert.match(invitationPage, /approveClientOrganization/);
  assert.match(invitationPage, /rejectClientOrganization/);
  assert.match(invitationPage, /Previously decided/);
  assert.match(invitationPage, /How access works/);
});

test("organization invitation navigation uses only direct active admin memberships", () => {
  const dashboard = read("app/dashboard/page.tsx");
  const inbox = read("app/dashboard/DashboardInboxControl.tsx");
  assert.match(dashboard, /organizationMemberships:[\s\S]*active: true[\s\S]*role: \{ in: \["OWNER", "ADMIN"\] \}/);
  assert.match(dashboard, /clientOrganization\.count/);
  assert.match(dashboard, /role: "PARTICIPATING"[\s\S]*status: "PENDING"[\s\S]*revokedAt: null/);
  assert.doesNotMatch(dashboard, /parentOrganization|childOrganizations/);
  assert.match(inbox, /Organization Invitations/);
  assert.match(inbox, /canReviewOrganizationInvitations/);
  assert.doesNotMatch(appHeader, /clientOrganization\.count|organizationMemberships/);
  assert.doesNotMatch(authenticatedHeader, /Organization Invitations/);
  assert.match(emptyDashboard, /href="\/portal\/organization\/invitations"[\s\S]*View My Organization Invitations/);
});

test("provider directory is exposed only through active Client organizations", () => {
  assert.match(actions, /clientOrganizations:[\s\S]*some: \{ clientId, status: "ACTIVE", revokedAt: null \}/);
  assert.match(actions, /organizationMembership\.findMany/);
  assert.match(actions, /active: true/);
  assert.match(actions, /status: "ACTIVE"/);
  assert.match(actions, /providerClients: \{ none: \{ clientId, revokedAt: null \} \}/);
  assert.match(actions, /AUTHORIZED_LOOKUP_RESULT_LIMIT/);
  assert.doesNotMatch(teamPage, /searchEligibleClientProviders/);
  assert.doesNotMatch(invitationPage, /provider\.find|providerClients/);
});

test("assignment validates origin, role, eligibility, duplicates, and audit provenance", () => {
  assert.match(actions, /requiredId\(formData, "organizationId"\)/);
  assert.match(actions, /select: \{ id: true, role: true \}/);
  assert.match(actions, /isEligibleClientAssignmentRole\(provider\.role\)/);
  assert.match(actions, /eligibleProviderWhere\(providerId, organizationId\)/);
  assert.match(actions, /providerId_clientId: \{ providerId, clientId \}/);
  assert.match(actions, /organizationId,[\s\S]*assignedById: actor\.id/);
  assert.match(actions, /PROVIDER_REACTIVATED/);
  assert.match(actions, /PROVIDER_ASSIGNED/);
  assert.match(policy, /status: "ACTIVE"/);
  assert.match(policy, /organizationMemberships:[\s\S]*organizationId,[\s\S]*active: true/);
});

test("multi-organization UI groups providers by explicit organization and role", () => {
  assert.match(teamPanel, /providerKey/);
  assert.match(teamPanel, /selectedProvider\.organization\.id/);
  assert.match(teamPanel, /providerId: selectedProvider\.id/);
  assert.doesNotMatch(teamPanel, /role: selectedProvider\.role/);
  assert.match(teamPanel, /Organization name/);
  assert.match(teamPanel, /groupedAssignments/);
  assert.match(teamPanel, /Current Care Team/);
});

test("list and detail routes share exact Client Team Manager eligibility", () => {
  assert.match(teamPage, /hasActiveClientTeamManagerAuthority\(session\.providerId, clientId\)/);
  assert.match(teamListPage, /hasActiveClientTeamManagerAuthority\([\s\S]*session\.providerId,[\s\S]*client\.id/);
  assert.doesNotMatch(teamListPage, /managedClientWhere|getManagedOrganizationIds/);
});

test("care-team and invitation controls are responsive and expose pending feedback", () => {
  assert.match(teamStyles, /@media \(max-width: 700px\)/);
  assert.match(teamStyles, /@media \(max-width: 520px\)/);
  assert.match(invitationStyles, /@media \(max-width: 440px\)/);
  assert.match(teamActionForm, /useActionState/);
  assert.match(teamActionForm, /aria-busy=\{pending\}/);
  assert.match(teamActionForm, /role=\{state\.status === "error" \? "alert" : "status"\}/);
});

test("Care Team polish keeps compact labeled searches and accessible explanations", () => {
  const autocomplete = read("components/ui/AuthorizedAutocomplete.tsx");
  assert.match(autocomplete, /type="search"/);
  assert.match(teamPanel, /label="Organization name"/);
  assert.match(teamPanel, /placeholder="Search organizations"/);
  assert.match(teamPanel, /label="Provider name"/);
  assert.match(teamPanel, /placeholder="Search providers"/);
  assert.match(teamPanel, /CareTeamInfo label="About organization access"/);
  assert.match(teamPanel, /CareTeamInfo label="About eligible providers"/);
  assert.match(teamPage, /CareTeamInfo label="About Client case codes"/);
  assert.match(teamInfo, /aria-expanded=\{open\}/);
  assert.match(teamInfo, /event\.key !== "Escape"/);
  assert.match(teamInfo, /pointerdown/);
  assert.match(teamInfo, /onMouseEnter/);
  assert.doesNotMatch(teamInfo, /onFocus=\{/);
  assert.match(teamStyles, /width: min\(100%, 560px\)/);
  assert.match(teamStyles, /color: var\(--muted-foreground\)/);
  assert.doesNotMatch(teamStyles, /color: var\(--muted\)/);
});

test("Phase 2 page controls use established radii, readable tokens, and aligned help", () => {
  assert.match(
    teamStyles,
    /\.detailsForm input:not\(\[type="hidden"\]\):not\(\[type="radio"\]\),[\s\S]*border-radius: 12px;[\s\S]*padding: 10px 12px/
  );
  assert.match(teamStyles, /\.panelSection \{[\s\S]*align-content: start/);
  assert.doesNotMatch(
    teamStyles,
    /\.searchForm input[^}]*border-radius: 999px/
  );
  assert.match(
    invitationPage,
    /InvitationInfo label="About organization invitations"/
  );
  assert.match(
    invitationPage,
    /sectionTitleRow[\s\S]*<h2>Pending<\/h2>[\s\S]*countBadge/
  );
  assert.match(
    invitationStyles,
    /\.sectionTitleRow \{ justify-content: space-between; \}/
  );
  assert.match(invitationStyles, /color: var\(--muted-foreground\)/);
  assert.doesNotMatch(invitationStyles, /color: var\(--muted\)/);
  assert.match(invitationInfo, /aria-label=\{label\}/);
  assert.match(invitationInfo, /event\.key !== "Escape"/);
  assert.match(invitationInfo, /pointerdown/);
  assert.match(invitationInfo, /onMouseEnter/);
  assert.doesNotMatch(invitationInfo, /onFocus=\{/);
});

test("provider and organization removal are audited soft revocations", () => {
  assert.doesNotMatch(actions, /providerClient\.delete|clientOrganization\.delete/);
  assert.doesNotMatch(supervisorActions, /providerClient\.delete/);
  assert.match(actions, /revokedAt: now,[\s\S]*revokedById: actor\.id/);
  assert.match(actions, /role: "PARTICIPATING",[\s\S]*status: "ACTIVE"/);
  assert.match(actions, /The lead organization cannot be revoked here/);
  assert.match(actions, /TEAM_MANAGER_REVOKED/);
  assert.match(actions, /PROVIDER_REVOKED/);
  assert.match(actions, /ORGANIZATION_REVOKED/);
});

test("all accepted state transitions write audit records after conditional checks", () => {
  for (const action of [
    "ORGANIZATION_REQUESTED",
    "ORGANIZATION_APPROVED",
    "ORGANIZATION_REVOKED",
    "PROVIDER_ASSIGNED",
    "PROVIDER_REACTIVATED",
    "PROVIDER_REVOKED",
    "TEAM_MANAGER_REVOKED",
  ]) assert.match(actions, new RegExp(action));
  assert.match(actions, /updated\.count !== 1/);
  assert.match(actions, /clientTeamAuditEvent\.(create|createMany)/);
  assert.match(actions, /boundedClientTeamAuditMetadata/);
});

test("every raw assignment read in production code explicitly excludes revocation", () => {
  const files = listSourceFiles(path.join(root, "app")).concat(listSourceFiles(path.join(root, "src")));
  const missing = [];
  for (const file of files) {
    if (file.includes(path.sep + "__tests__" + path.sep)) continue;
    const source = fs.readFileSync(file, "utf8");
    for (const expression of [/providerClient\.find(?:First|Many)\s*\(/g, /providerClients\s*:\s*\{/g]) {
      let match;
      while ((match = expression.exec(source))) {
        const nearby = source.slice(match.index, match.index + 500);
        if (!/revokedAt|activeClientAssignmentWhere/.test(nearby)) {
          missing.push(path.relative(root, file) + ":" + source.slice(0, match.index).split("\n").length);
        }
      }
    }
  }
  assert.deepEqual(missing, []);
});

test("historical clinical records are outside Client-team mutation scope", () => {
  assert.doesNotMatch(
    actions + supervisorActions,
    /entry\.(delete|deleteMany|update)|goalDefinition\.(delete|deleteMany|update)|assessmentItem\.(delete|deleteMany|update)|fieldObservation\.(delete|deleteMany|update)/
  );
  assert.doesNotMatch(policy, /caseCode/);
});

function listSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}
