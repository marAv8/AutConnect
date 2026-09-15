/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const originalTsLoader = Module._extensions[".ts"];
Module._extensions[".ts"] = function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const state = require(path.join(
  root,
  "app/components/administrative/administrativeCarouselState.ts"
));
const carousel = read("app/components/administrative/AdministrativeCarousel.tsx");
const carouselStyles = read("app/components/administrative/AdministrativeCarousel.module.css");
const swipe = read("components/useGuardedSwipe.ts");
const careTeamPage = read("app/portal/supervisor/edit-providers/[clientId]/page.tsx");
const careTeamPanel = read("app/portal/supervisor/edit-providers/[clientId]/ClientTeamPanel.tsx");
const createClient = read("app/portal/supervisor/create-client/CreateClientProvidersForm.tsx");
const attachClient = read("app/portal/organization/attach-client/AttachClientRequestForm.tsx");
const inviteTeam = read("app/portal/supervisor/invitations/OrganizationInvitationForm.tsx");
const invitationInbox = read("app/portal/organization/client-invitations/page.tsx");
const supervisorDashboard = read("app/dashboard/SupervisorDashboard.tsx");

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

test("shared carousel bounds cards and exposes a stable position", () => {
  assert.equal(state.boundedAdministrativeCard(-1, 4), 0);
  assert.equal(state.boundedAdministrativeCard(7, 4), 3);
  assert.equal(state.administrativeCardPosition(2, 4), "3 of 4");
  assert.match(carousel, /Previous card/);
  assert.match(carousel, /Next card/);
  assert.match(carousel, /aria-live="polite"/);
});

test("card changes are local and never participate in browser history", () => {
  assert.match(carousel, /setActiveIndex\(nextIndex\)/);
  assert.doesNotMatch(carousel, /history\.|router\.|location\./);
  assert.match(carousel, /hidden=\{index !== activeIndex\}/);
});

test("buttons, direct section selection, and keyboard arrows can visit any card", () => {
  assert.match(carousel, /onClick=\{\(\) => moveTo\(index\)\}/);
  assert.match(carousel, /event\.key === "ArrowLeft"/);
  assert.match(carousel, /event\.key === "ArrowRight"/);
  assert.match(carousel, /navigationMode === "steps"[\s\S]*\? "step"[\s\S]*: "page"/);
});

test("the active selector is revealed with horizontal-only scrolling", () => {
  assert.match(carousel, /sectionNavRef/);
  assert.match(carousel, /sectionButtonRefs/);
  assert.match(carousel, /nav\.scrollTo\(/);
  assert.match(carousel, /buttonEnd - nav\.clientWidth/);
  assert.doesNotMatch(carousel, /scrollIntoView/);
});

test("revisitable sections do not present themselves as required completion steps", () => {
  assert.match(carousel, /navigationMode\?: "steps" \| "sections"/);
  assert.match(carousel, /navigationMode="sections"/);
  assert.match(careTeamPage, /navigationMode="sections"/);
});

test("all accepted viewport sizes use intrinsic short cards and one bounded overflow region", () => {
  const viewports = [
    [390, 844],
    [440, 956],
    [768, 1024],
    [912, 1368],
    [1280, 800],
    [1440, 900],
    [1728, 1117],
  ];

  assert.doesNotMatch(carouselStyles, /\.shell\s*\{[^}]*min-height/s);
  assert.doesNotMatch(carouselStyles, /\.card\s*\{[^}]*min-height/s);
  assert.match(carouselStyles, /max-height: max\(280px, calc\(100dvh - 330px\)\)/);
  assert.match(carouselStyles, /overflow-y: auto/);
  assert.match(carouselStyles, /min-height: 44px/);

  for (const [, height] of viewports) {
    const compact = height <= 956;
    const availableHeight = Math.max(compact ? 240 : 280, height - (compact ? 300 : 330));
    assert.ok(availableHeight >= 240);
    assert.ok(availableHeight < height);
  }
});

test("swipes require horizontal intent and preserve vertical scrolling", () => {
  assert.equal(state.administrativeSwipeDirection(-70, 5), "next");
  assert.equal(state.administrativeSwipeDirection(70, 5), "previous");
  assert.equal(state.administrativeSwipeDirection(70, 80), null);
  assert.equal(state.administrativeSwipeDirection(20, 0), null);
  assert.match(carouselStyles, /touch-action: pan-y/);
  assert.match(swipe, /axisRef\.current !== "horizontal"/);
  assert.match(swipe, /shouldPreserveInteractiveClick/);
});

test("Safari edge gestures are reserved and reduced motion is honored", () => {
  assert.equal(state.startsInsideBrowserEdge(10, 390), true);
  assert.equal(state.startsInsideBrowserEdge(200, 390), false);
  assert.match(carousel, /edgeGuard: ADMINISTRATIVE_EDGE_GUARD/);
  assert.match(swipe, /isWithinSwipeEdgeGuard\(event\.clientX, window\.innerWidth, edgeGuard\)/);
  assert.match(swipe, /clientX <= edgeGuard \|\| clientX >= viewportWidth - edgeGuard/);
  assert.match(carouselStyles, /prefers-reduced-motion: reduce/);
  assert.match(carouselStyles, /transition: none !important/);
});

test("Care Team has the four approved cards without splitting Provider context", () => {
  for (const label of ["Client Details", "Attach Requests", "Client Organizations", "Care Team Providers"]) {
    assert.match(careTeamPage, new RegExp(`label: "${label}"`));
  }
  assert.match(careTeamPanel, /mode !== "organizations"[\s\S]*Assigned providers[\s\S]*Add a provider/);
});

test("Care Team searches stay in their active card with complete local feedback", () => {
  assert.match(careTeamPanel, /event\.preventDefault\(\)/);
  assert.match(careTeamPanel, /searchOrganizationsForClient\(clientId, query\)/);
  assert.match(careTeamPanel, /searchEligibleClientProviders\(clientId, organization\.id, query\)/);
  for (const status of ["loading", "too-short", "empty", "error", "results"]) {
    assert.match(careTeamPanel, new RegExp(`"${status}"`));
  }
  assert.doesNotMatch(careTeamPanel, /method="get"|history\.|router\.|location\./);
});

test("searches and mutations suppress duplicate rapid submissions", () => {
  assert.match(careTeamPanel, /if \(organizationSearchPending\.current\) return/);
  assert.match(careTeamPanel, /if \(providerSearchPending\.current\) return/);
  assert.match(careTeamPanel, /disabled=\{organizationState === "loading"\}/);
  assert.match(careTeamPanel, /disabled=\{providerState === "loading"\}/);
  assert.match(read("app/portal/supervisor/edit-providers/[clientId]/ClientTeamActionForm.tsx"), /disabled=\{pending\}/);
});

test("Add Client uses four retained-state cards and submits only from final review", () => {
  for (const label of ["Client Details", "Responsible Organization", "Initial Providers", "Review and Create"]) {
    assert.match(createClient, new RegExp(`label: "${label}"`));
  }
  assert.equal((createClient.match(/type="submit"/g) ?? []).length, 0);
  assert.match(createClient, /AdministrativeSubmitButton[\s\S]*Create Client/);
  assert.match(createClient, /useState\(""\)/);
});

test("Attach Existing Client uses three cards and submits only on review", () => {
  for (const label of ["Requesting Organization", "Client Case Code", "Review and Request"]) {
    assert.match(attachClient, new RegExp(`label: "${label}"`));
  }
  assert.match(attachClient, /case code identifies an existing Client\. It does not grant Client access/);
  assert.equal((attachClient.match(/type="submit"/g) ?? []).length, 1);
  assert.match(attachClient, /disabled=\{pending \|\| !organizationId \|\| !caseCode\.trim\(\)\}/);
});

test("Invite Team keeps recipient context and fresh copy feedback together without losing it to history", () => {
  const page = read("app/portal/supervisor/invitations/InvitationAdministration.tsx");
  assert.match(page, /label: "Create Invitation"/);
  assert.match(page, /navigationMode="records"/);
  assert.match(inviteTeam, /onIssued\?\.\(result\)/);
  assert.match(page, /label: "Ready to Copy"[\s\S]*fresh.recipient\?\.email[\s\S]*<InvitationResult state=\{fresh\}/);
  assert.match(page, /Invitation History/);
  assert.match(page, /invitation.status !== "Pending"/);
  assert.doesNotMatch(inviteTeam, /key=\{state.status\}|initialCardId/);
  assert.match(inviteTeam, /No email is sent/);
  assert.match(inviteTeam, /disabled=\{pending \|\| !organizationId \|\| !email \|\| !providerRole\}/);
});

test("Organization Invitations is a two-card inbox and Remove Client stays in the Dashboard grid", () => {
  assert.match(invitationInbox, /label: "Pending"/);
  assert.match(invitationInbox, /label: "Previously Decided"/);
  assert.match(invitationInbox, /AdministrativeCarouselSections/);
  assert.match(supervisorDashboard, /mode === "grid" \|\| mode === "remove"/);
  assert.doesNotMatch(supervisorDashboard, /RemoveClientView/);
});

test("workflow content does not add a second paper surface inside the shared card", () => {
  const attachPage = read("app/portal/organization/attach-client/page.tsx");
  const careTeamAttach = read("app/portal/supervisor/edit-providers/[clientId]/ClientAttachRequestPanel.tsx");
  assert.doesNotMatch(invitationInbox, /<section className=\{`paper-surface/);
  assert.doesNotMatch(careTeamPanel, /<section className=\{`paper-surface/);
  assert.doesNotMatch(careTeamAttach, /<section className=\{`paper-surface/);
  assert.match(attachPage, /className=\{styles\.workflowSection\}/);
});

test("shared UI does not alter administrative actions or disclosure selections", () => {
  const action = read("app/actions/manageClientTeam.ts");
  assert.match(action, /requireTeamManager\(tx, actor\.id, clientId\)/);
  assert.match(action, /select: \{ id: true, name: true, type: true \}/);
  assert.match(action, /activeClientOrganizationWhere\(clientId, organizationId\)/);
  assert.doesNotMatch(carousel, /server|database|authorization|returnTo/);
});
