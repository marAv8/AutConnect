/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const header = read("app/components/AuthenticatedPageHeader.tsx");
const appHeader = read("app/components/AppUserHeader.tsx");
const dashboardPage = read("app/dashboard/page.tsx");
const workspace = read("app/dashboard/DashboardWorkspaceLayout.tsx");
const supervisor = read("app/dashboard/SupervisorDashboard.tsx");
const supervisorMenu = read("app/dashboard/SupervisorDashboardMenu.tsx");
const provider = read("app/dashboard/ProviderDashboard.tsx");
const providerMenu = read("app/dashboard/ProviderDashboardMoreMenu.tsx");
const inbox = read("app/dashboard/DashboardInboxControl.tsx");
const menuHook = read("app/dashboard/useDismissibleMenu.ts");
const caseSupportPage = read("app/portal/case-support/requests/page.tsx");
const caseSupportActions = read("app/actions/manageCaseSupport.ts");
const invitationPage = read("app/portal/organization/client-invitations/page.tsx");
const invitationActions = read("app/actions/manageClientTeam.ts");
const fieldObservation = read(
  "app/portal/supervisor/field-observation/[clientId]/FieldObservationForm.tsx"
);
const fieldObservationStyles = read(
  "app/portal/supervisor/field-observation/[clientId]/FieldObservationForm.module.css"
);
const styles = read("app/globals.css");

test("persistent authenticated headers contain identity and logout but no administration row", () => {
  assert.match(header, /className="app-user-header-logo"/);
  assert.match(header, /action=\{logoutProvider\}/);
  assert.doesNotMatch(header, /Attach Existing Client|Organization Invitations/);
  assert.doesNotMatch(appHeader, /organizationMemberships|clientOrganization\.count/);
});

test("Supervisor More keeps top-level actions and nests only Client administration", () => {
  assert.ok(supervisorMenu.indexOf(">\n                  Client Administration") < supervisorMenu.indexOf(">\n                  Invite Team"));
  assert.ok(supervisorMenu.indexOf(">\n                  Invite Team") < supervisorMenu.indexOf(">\n                How AutConnect Works"));
  assert.match(supervisorMenu, /aria-expanded=\{clientAdministrationOpen\}/);
  assert.match(supervisorMenu, /aria-controls="supervisor-client-administration-menu"/);
  assert.match(supervisorMenu, /id="supervisor-client-administration-menu"[\s\S]*Add Client[\s\S]*Attach Existing Client[\s\S]*Remove Client/);
});

test("nested Client administration resets with the established dismissible menu lifecycle", () => {
  assert.match(supervisorMenu, /const toggleMenu = \(\) => \{[\s\S]*setClientAdministrationOpen\(false\);[\s\S]*onToggle\(\)/);
  assert.match(supervisorMenu, /const closeMenu = \(\) => \{[\s\S]*setClientAdministrationOpen\(false\);[\s\S]*onClose\(\)/);
  assert.match(menuHook, /event\.key !== "Escape"/);
  assert.match(menuHook, /window\.addEventListener\("pointerdown", onPointerDown\)/);
  assert.doesNotMatch(menuHook, /history\.(?:pushState|replaceState|back)/);
});

test("non-Supervisor organization administrators retain Attach Existing Client without a persistent header action", () => {
  assert.match(dashboardPage, /canAttachExistingClient=\{[\s\S]*administrativeCapabilities\.canAttachExistingClient/);
  assert.match(provider, /canAttachExistingClient \? \([\s\S]*<ProviderDashboardMoreMenu/);
  assert.match(providerMenu, /href="\/portal\/organization\/attach-client"/);
  assert.doesNotMatch(header, /portal\/organization\/attach-client/);
});

test("the inbox keeps Case Support Requests as its first and unchanged Case Support destination", () => {
  assert.match(inbox, /href="\/portal\/case-support\/requests"/);
  assert.match(inbox, />\s*Case Support Requests\s*</);
  assert.ok(inbox.indexOf("Case Support Requests") < inbox.indexOf("Organization Invitations"));
  assert.match(supervisorMenu, /<DashboardInboxControl[\s\S]*canAccessCaseSupport/);
});

test("Case Support count remains separate from the organization invitation count", () => {
  assert.match(inbox, /canAccessCaseSupport && caseSupportCount > 0/);
  assert.match(inbox, /dashboard-case-support-badge[\s\S]*\{caseSupportCount\}/);
  assert.match(inbox, /organizationInvitationCount > 0[\s\S]*\{organizationInvitationCount\}/);
  assert.doesNotMatch(inbox, /caseSupportCount\s*\+\s*organizationInvitationCount/);
  assert.doesNotMatch(dashboardPage, /caseSupportNotificationCount\s*\+\s*pendingOrganizationInvitationCount/);
});

test("personal invitations remain discoverable while Client organization invitations stay capability-gated", () => {
  assert.match(inbox, /href="\/portal\/organization\/invitations"/);
  assert.doesNotMatch(inbox, /if \(!canAccessCaseSupport && !canReviewOrganizationInvitations\) return null/);
  assert.match(inbox, /\{canReviewOrganizationInvitations \? \([\s\S]*href="\/portal\/organization\/client-invitations"[\s\S]*Client Organization Invitations/);
  assert.match(dashboardPage, /administrativeCapabilities\.canReviewOrganizationInvitations[\s\S]*\? await db\.clientOrganization\.count/);
  assert.match(dashboardPage, /role: "PARTICIPATING"[\s\S]*status: "PENDING"[\s\S]*revokedAt: null/);
});

test("invitation authority does not grant Case Support authority and Case Support authority does not grant invitations", () => {
  assert.match(provider, /canAccessCaseSupport=\{false\}/);
  assert.match(inbox, /\{canAccessCaseSupport \? \([\s\S]*href="\/portal\/case-support\/requests"/);
  assert.match(inbox, /\{canReviewOrganizationInvitations \? \([\s\S]*href="\/portal\/organization\/client-invitations"/);
  assert.match(caseSupportPage, /if \(session\.role !== "Supervisor"\)[\s\S]*redirect\("\/dashboard"\)/);
  assert.match(invitationPage, /db\.organizationMembership\.findMany\([\s\S]*active: true[\s\S]*role: \{ in: \["OWNER", "ADMIN"\] \}/);
});

test("Case Support workflow, permissions, actions, records, and audit implementation remain intact", () => {
  for (const action of [
    "acknowledgeCaseSupportRequest",
    "convertCaseSupportRequest",
    "declineCaseSupportRequest",
    "openCaseSupportNotification",
  ]) {
    assert.match(caseSupportPage, new RegExp(action));
  }
  assert.match(caseSupportPage, /db\.caseSupportRequest\.findMany/);
  assert.match(caseSupportPage, /db\.caseSupportNotification\.findMany/);
  assert.match(caseSupportActions, /CaseSupportAuditEvent|caseSupportAuditEvent|audit/i);
});

test("Case Support and invitation routes retain independent server authorization and writes", () => {
  assert.match(caseSupportActions, /requireRequestRecipient/);
  assert.match(caseSupportActions, /recipientSupervisorId/);
  assert.match(invitationActions, /tx\.organizationMembership\.findFirst\([\s\S]*active: true[\s\S]*role: \{ in: \["OWNER", "ADMIN"\] \}/);
  assert.match(invitationActions, /approveClientOrganization/);
  assert.match(invitationActions, /rejectClientOrganization/);
  assert.doesNotMatch(inbox, /db\.|caseSupportRequest\.|clientOrganization\./);
});

test("utility controls occupy a reserved footer row and keep stage content above them", () => {
  assert.match(workspace, /className="dashboard-client-stage-region"[\s\S]*className="dashboard-utility-footer-region"/);
  assert.match(styles, /\.dashboard-utility-footer-region \{[\s\S]*position: fixed;[\s\S]*safe-area-inset-bottom/);
  assert.match(styles, /\.dashboard-client-stage-region \{[\s\S]*overflow: hidden/);
  assert.match(styles, /\.dashboard-utility-dock \{[\s\S]*justify-content: center/);
  assert.doesNotMatch(styles, /--dashboard-dock-stage-inset|\.dashboard-utility-controls \{[^}]*margin-left/);
  assert.match(supervisor, /floatingMenu=\{floatingMenu\}/);
});

test("mobile header shares one row, protects long identity text, and retains touch targets", () => {
  assert.match(styles, /\.app-user-header-row \{[\s\S]*align-items: flex-start/);
  assert.match(styles, /\.app-user-header-logo \{[\s\S]*min-height: 44px/);
  assert.match(styles, /\.app-user-header-title \{[\s\S]*overflow-wrap: anywhere/);
  assert.match(styles, /\.app-user-header-logout \{[\s\S]*min-height: 44px/);
  assert.match(styles, /@media \(max-width: 520px\)[\s\S]*\.app-user-header-row \{[\s\S]*flex-wrap: nowrap/);
  assert.match(styles, /\.app-user-header-identity \{[\s\S]*min-width: 0/);
});

test("Field Observation date and time keeps native semantics while its full ownership chain is width-bounded", () => {
  assert.match(fieldObservation, /type="datetime-local"/);
  assert.match(fieldObservation, /value=\{observedAt\}/);
  assert.match(fieldObservationStyles, /\.detailsGrid \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);[\s\S]*min-width: 0/);
  assert.match(fieldObservationStyles, /\.field,[\s\S]*\.noteField \{[\s\S]*min-width: 0/);
  assert.match(fieldObservationStyles, /\.field input,[\s\S]*width: 100%;[\s\S]*min-width: 0;[\s\S]*max-width: 100%;[\s\S]*box-sizing: border-box/);
  assert.match(fieldObservationStyles, /\.field input\[type="datetime-local"\] \{[\s\S]*max-width: 100%/);
  assert.match(fieldObservationStyles, /@supports \(-webkit-touch-callout: none\)[\s\S]*width: calc\(100% - 24px\)/);
});
