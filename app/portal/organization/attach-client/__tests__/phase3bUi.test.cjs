/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const requestPage = read("app/portal/organization/attach-client/page.tsx");
const requestForm = read(
  "app/portal/organization/attach-client/AttachClientRequestForm.tsx"
);
const requestAction = read(
  "app/portal/organization/attach-client/AttachRequestAction.tsx"
);
const requestStyles = read(
  "app/portal/organization/attach-client/page.module.css"
);
const teamPage = read(
  "app/portal/supervisor/edit-providers/[clientId]/page.tsx"
);
const teamPanel = read(
  "app/portal/supervisor/edit-providers/[clientId]/ClientAttachRequestPanel.tsx"
);
const decisionCard = read(
  "app/portal/supervisor/edit-providers/[clientId]/ClientAttachDecisionCard.tsx"
);
const teamStyles = read(
  "app/portal/supervisor/edit-providers/[clientId]/CareTeamPage.module.css"
);
const headerLoader = read("app/components/AppUserHeader.tsx");
const header = read("app/components/AuthenticatedPageHeader.tsx");
const dashboardMenu = read("app/dashboard/SupervisorDashboardMenu.tsx");
const dashboard = read("app/dashboard/SupervisorDashboard.tsx");
const emptyState = read("app/dashboard/FirstClientEmptyState.tsx");
const policy = read("src/lib/clientAttachPolicy.ts");

test("attach route is limited to direct active organization administrators", () => {
  assert.match(requestPage, /requireCurrentProvider\(\)/);
  assert.match(
    requestPage,
    /organizationMembership\.findMany[\s\S]*providerId: provider\.id[\s\S]*active: true[\s\S]*role: \{ in: \["OWNER", "ADMIN"\] \}/
  );
  assert.doesNotMatch(requestPage, /parentOrganization|childOrganizations/);
  assert.doesNotMatch(requestPage, /providerClient\.(create|update|upsert)/);
});

test("request form submits only selected organization and bounded case code", () => {
  assert.match(requestForm, /requestExistingClientAttachment/);
  assert.match(requestForm, /name="organizationId"/);
  assert.match(requestForm, /name="caseCode"/);
  assert.match(requestForm, /maxLength=\{128\}/);
  assert.match(requestForm, /autoComplete="off"/);
  assert.doesNotMatch(requestForm, /clientId|clientName|dateOfBirth/);
  assert.doesNotMatch(requestPage, /client\.findMany|client\.findFirst/);
});

test("request response preserves the fixed non-disclosing contract", () => {
  assert.match(requestForm, /role="status"/);
  assert.match(
    policy,
    /If the case code is valid and eligible, the request will be reviewed\./
  );
  assert.match(requestPage, /No Client details are shown before approval/);
});

test("request history omits Client identity and allows only original requester cancellation", () => {
  const requestQuery = requestPage.slice(
    requestPage.indexOf("db.clientAttachRequest.findMany"),
    requestPage.indexOf("const pendingRequests")
  );
  assert.doesNotMatch(
    requestQuery,
    /client:\s*\{|caseCode|firstName|lastName|dateOfBirth|entries|goals|providerClients/
  );
  assert.match(requestPage, /request\.requestedById === provider\.id/);
  assert.match(requestAction, /cancelClientAttachRequest/);
  assert.match(requestAction, /window\.confirm/);
});

test("exact Team Manager page loads only that Client's attach requests", () => {
  assert.match(
    teamPage,
    /hasActiveClientTeamManagerAuthority\(session\.providerId, clientId\)/
  );
  assert.match(teamPage, /where: \{ id: clientId \}/);
  assert.match(teamPage, /attachRequests:[\s\S]*status: true/);
  assert.match(teamPage, /<ClientAttachRequestPanel requests=\{client\.attachRequests\}/);
});

test("Team Manager decisions expose explicit consequences and bounded notes", () => {
  assert.match(decisionCard, /approveClientAttachRequest/);
  assert.match(decisionCard, /rejectClientAttachRequest/);
  assert.match(decisionCard, /name="requestId"/);
  assert.match(decisionCard, /name="reason"/);
  assert.match(decisionCard, /maxLength=\{256\}/);
  assert.match(decisionCard, /No provider will be assigned automatically/);
  assert.match(decisionCard, /window\.confirm/);
  assert.match(teamPanel, /Only an active Team Manager for this exact/);
  assert.match(teamPanel, /grants no organization-wide Client access/);
});

test("Attach, invitation, and provider assignment remain distinct UI workflows", () => {
  const dashboardPage = read("app/dashboard/page.tsx");
  const inbox = read("app/dashboard/DashboardInboxControl.tsx");
  assert.doesNotMatch(headerLoader, /canRequestClientAttachment/);
  assert.doesNotMatch(header, /Attach Existing Client|Organization Invitations/);
  assert.match(dashboardPage, /canReviewOrganizationInvitations/);
  assert.match(inbox, /href="\/portal\/organization\/client-invitations"/);
  assert.match(dashboardMenu, /Attach Existing Client/);
  assert.match(emptyState, /Attach an Existing Client/);
  assert.doesNotMatch(dashboardMenu, />\s*Link Client\s*</);
  assert.doesNotMatch(dashboard, /addSupervisorClient|availableClients|mode: "add"/);
});

test("Phase 3B controls retain labels, pending states, and responsive layouts", () => {
  assert.match(requestForm, /htmlFor="attach-organization"/);
  assert.match(requestForm, /htmlFor="attach-case-code"/);
  assert.match(requestForm, /aria-busy=\{pending\}/);
  assert.match(decisionCard, /aria-busy=\{pending\}/);
  assert.match(requestAction, /role=\{state\.status === "error" \? "alert" : "status"\}/);
  assert.match(requestStyles, /@media \(max-width: 700px\)/);
  assert.match(requestStyles, /@media \(max-width: 440px\)/);
  assert.match(teamStyles, /\.attachDecisionForms[\s\S]*grid-template-columns: repeat\(2/);
  assert.match(
    teamStyles,
    /@media \(max-width: 700px\)[\s\S]*\.attachDecisionForms \{ grid-template-columns: 1fr; \}/
  );
});
