/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

test("View Notes keeps the seven-calendar-day history window and assigned-client gate", () => {
  const page = read("app/portal/notes/view/page.tsx");
  const route = read("app/api/notes/history/route.ts");
  const documentationDay = read("app/libs/documentationDay.ts");

  assert.match(page, /providerClients:[\s\S]*?providerId: session\.providerId[\s\S]*?revokedAt: null/);
  assert.match(page, /date:\s*\{\s*gte: sevenDaysAgo/);
  assert.match(page, /start\.setDate\(start\.getDate\(\) - 6\)/);
  assert.match(route, /providerClients:[\s\S]*?providerId: session\.providerId[\s\S]*?revokedAt: null/);
  assert.match(route, /date:\s*\{\s*gte: sevenDaysAgo/);
  assert.match(route, /sevenDayHistoryStart\(\)/);
  assert.match(documentationDay, /start\.setDate\(start\.getDate\(\) - 6\)/);
});

test("dashboard navigation preserves selected Client identity in orbit URLs and return links", () => {
  const providerDashboard = read("app/dashboard/ProviderDashboard.tsx");
  const supervisorDashboard = read("app/dashboard/SupervisorDashboard.tsx");
  const dashboardPage = read("app/dashboard/page.tsx");
  const noteAdd = read("app/portal/notes/add/NoteOverlay.tsx");
  const noteHistory = read("app/portal/notes/view/NoteHistoryViewer.tsx");
  const caseSupport = read("app/portal/case-support/[clientId]/page.tsx");

  for (const dashboard of [providerDashboard, supervisorDashboard]) {
    assert.match(
      dashboard,
      /`\/dashboard\?clientId=\$\{encodeURIComponent\(activeClientId\)\}&view=orbit`/,
    );
    assert.match(dashboard, /activeClientId: clientId/);
    assert.match(dashboard, /window\.history\.replaceState/);
  }
  assert.match(dashboardPage, /initialClientId=\{clientId\}/);
  assert.match(dashboardPage, /forceOrbitView=\{view === "orbit"\}/);
  for (const destination of [noteAdd, noteHistory, caseSupport]) {
    assert.match(destination, /\/dashboard\?clientId=\$\{clientId\}&view=orbit/);
  }
});

test("theme selection remains local presentation state with no data or authorization effects", () => {
  const toggle = read("app/components/ThemeToggle.tsx");
  const layout = read("app/layout.tsx");
  const combined = `${toggle}\n${layout}`;

  assert.match(toggle, /window\.localStorage\.setItem\(THEME_STORAGE_KEY, theme\)/);
  assert.match(toggle, /document\.documentElement\.classList\.toggle\("dark", isDark\)/);
  assert.match(layout, /window\.localStorage\.getItem\("autconnect-theme"\)/);
  assert.doesNotMatch(combined, /@\/app\/actions|@\/lib\/db|@\/lib\/session/);
  assert.doesNotMatch(combined, /\bfetch\s*\(|<form|type="submit"/);
});

test("high-value mutation controls expose an in-flight guard against duplicate submission", () => {
  const entryForm = read("app/portal/notes/add/EntryForm.tsx");
  const specializedEntryForms = read(
    "app/portal/notes/add/EntrySpecializedForms.tsx",
  );
  const observationEntryForm = read(
    "app/portal/notes/add/ObservationEntryForm.tsx",
  );
  const invitationButton = read(
    "app/portal/organization/client-invitations/InvitationDecisionButtons.tsx",
  );
  const attachForm = read(
    "app/portal/organization/attach-client/AttachClientRequestForm.tsx",
  );
  const clientTeamAction = read(
    "app/portal/supervisor/edit-providers/[clientId]/ClientTeamActionForm.tsx",
  );

  assert.match(entryForm, /setSaveStatus\("saving"\)/);
  assert.match(entryForm, /disabled=\{saveStatus === "saving"\}/);
  assert.match(specializedEntryForms, /disabled=\{saveStatus === "saving"\}/);
  assert.match(observationEntryForm, /disabled=\{saveStatus === "saving"\}/);
  for (const actionControl of [invitationButton, clientTeamAction]) {
    assert.match(actionControl, /disabled=\{pending\}/);
    assert.match(actionControl, /aria-busy=\{pending\}/);
  }
  assert.match(attachForm, /disabled=\{pending \|\| !organizationId \|\| !caseCode\.trim\(\)\}/);
  assert.match(attachForm, /aria-busy=\{pending\}/);
});

test("publication feedback and same-day update affordance stay separate from unread signals", () => {
  const carousel = read("app/dashboard/ClientCarousel.tsx");
  const orbit = read("app/dashboard/ClientOrbit.tsx");
  const formDataLoader = read("app/libs/noteFormData.ts");

  assert.match(carousel, /role="status"/);
  assert.match(carousel, /aria-live="polite"/);
  assert.match(carousel, /useReducedMotion\(\)/);
  assert.match(carousel, />\s*Note published\s*</);
  assert.doesNotMatch(carousel, /"Note submitted"/);
  assert.doesNotMatch(carousel, /"Changes saved"/);
  assert.match(orbit, /FilePenLine/);
  assert.match(orbit, /"Continue today's note"/);
  assert.match(orbit, /"Published — view or update today's note"/);
  assert.match(orbit, /existingEntry \? "update" : "add"/);
  assert.match(
    formDataLoader,
    /providerId_clientId_date_kind:[\s\S]*providerId,[\s\S]*clientId,[\s\S]*date: today,[\s\S]*kind: entryKind/,
  );
});
