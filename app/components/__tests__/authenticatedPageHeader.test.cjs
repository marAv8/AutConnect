/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

function source(relativePath) {
  return fs.readFileSync(path.join(__dirname, relativePath), "utf8");
}

const headerSource = source("../AuthenticatedPageHeader.tsx");
const loaderSource = source("../AppUserHeader.tsx");
const dashboardSource = source("../../dashboard/page.tsx");
const inboxSource = source("../../dashboard/DashboardInboxControl.tsx");
const portalLayoutSource = source("../../portal/layout.tsx");
const dashboardOverlaySource = source("../../dashboard/DashboardNoteOverlay.tsx");
const noteOverlaySource = source("../../portal/notes/add/NoteOverlay.tsx");
const specializedNoteSource = source(
  "../../portal/notes/add/EntrySpecializedForms.tsx"
);
const noteHistorySource = source("../../portal/notes/view/NoteHistoryViewer.tsx");
const fieldObservationSource = source(
  "../../portal/supervisor/field-observation/[clientId]/FieldObservationForm.tsx"
);
const caseSupportSource = source("../../portal/case-support/[clientId]/page.tsx");
const globalStyles = source("../../globals.css");
const viewportStabilizer = source("../AuthenticatedViewportStabilizer.tsx");

test("the shared authenticated header links AC to the dashboard and preserves logout", () => {
  assert.match(headerSource, /<header className="app-user-header">/);
  assert.match(headerSource, /href="\/dashboard"/);
  assert.match(headerSource, /aria-label="AutConnect dashboard"/);
  assert.match(headerSource, /action=\{logoutProvider\}/);
  assert.match(headerSource, /formatBadgeRole\(role\)/);
  assert.match(loaderSource, /<AuthenticatedPageHeader/);
});

test("organization administration is absent from persistent headers and directly scoped in the dashboard inbox", () => {
  assert.doesNotMatch(headerSource, /Attach Existing Client|Organization Invitations/);
  assert.doesNotMatch(loaderSource, /clientOrganization\.count|organizationMemberships/);
  assert.match(dashboardSource, /organizationMemberships:[\s\S]*active: true/);
  assert.match(dashboardSource, /role: \{ in: \["OWNER", "ADMIN"\] \}/);
  assert.match(dashboardSource, /clientOrganization\.count/);
  assert.match(dashboardSource, /role: "PARTICIPATING"[\s\S]*status: "PENDING"[\s\S]*revokedAt: null/);
  assert.doesNotMatch(dashboardSource, /parentOrganization|childOrganizations/);
  assert.match(inboxSource, /href="\/portal\/organization\/client-invitations"/);
  assert.match(inboxSource, /Organization Invitations/);
});

test("portal destinations share the authenticated header through their layout", () => {
  assert.match(portalLayoutSource, /<AppUserHeader \/>/);
  assert.match(fieldObservationSource, />\s*Back\s*<\/Link>/);
  assert.match(caseSupportSource, />\s*Back\s*<\/Link>/);
});

test("Clinical Note and View Notes render the shared header above a short Back row", () => {
  for (const pageSource of [
    dashboardOverlaySource,
    noteOverlaySource,
    noteHistorySource,
  ]) {
    assert.match(pageSource, /<AuthenticatedPageHeader/);
    assert.match(pageSource, />\s*Back\s*<\/(?:button|Link)>/);
    assert.doesNotMatch(pageSource, /Back to Client|Back to Case Support Workspace/);
  }

  assert.ok(
    noteOverlaySource.indexOf("<AuthenticatedPageHeader") <
      noteOverlaySource.indexOf('className="back-link"')
  );
  assert.ok(
    noteHistorySource.indexOf("<AuthenticatedPageHeader") <
      noteHistorySource.indexOf('className="back-link"')
  );
  assert.match(specializedNoteSource, /showProviderIdentity=\{false\}/);
});

test("the shared header remains bounded and readable at mobile widths", () => {
  assert.match(
    globalStyles,
    /\.app-user-header \{[\s\S]*width: min\(100%, 1280px\)/
  );
  assert.match(globalStyles, /\.app-user-header-logo[\s\S]*min-height: 44px/);
  assert.match(globalStyles, /\.app-user-header-logout[\s\S]*min-height: 44px/);
  assert.match(
    globalStyles,
    /@media \(max-width: 520px\)[\s\S]*\.app-user-header-identity[\s\S]*max-width: calc\(100% - 58px\)/
  );
  assert.match(globalStyles, /\.app-user-header-row \{[\s\S]*align-items: flex-start/);
  assert.match(globalStyles, /\.app-shell-pad \{[\s\S]*safe-area-inset-top/);
  assert.match(globalStyles, /\.app-user-header-identity \{[\s\S]*display: grid;[\s\S]*justify-items: end/);
  assert.match(globalStyles, /\.app-user-header-logout-row \{[\s\S]*margin-top: 0/);
  assert.match(globalStyles, /\.app-user-header-logout \{[\s\S]*padding: 4px 0 0/);
  assert.doesNotMatch(globalStyles, /\.app-user-header-navigation/);
});

test("dashboard offset correction does not replace browser scroll restoration", () => {
  assert.match(viewportStabilizer, /window\.scrollTo\(0, 0\)/);
  assert.doesNotMatch(viewportStabilizer, /scrollRestoration/);
  assert.doesNotMatch(globalStyles, /Safari address-bar|localhost toolbar/);
});
