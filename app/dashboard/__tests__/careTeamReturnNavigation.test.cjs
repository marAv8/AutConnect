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
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const navigation = require(path.join(root, "app/dashboard/dashboardNavigation.ts"));
const dashboard = read("app/dashboard/SupervisorDashboard.tsx");
const menu = read("app/dashboard/SupervisorDashboardMenu.tsx");
const page = read("app/portal/supervisor/edit-providers/[clientId]/page.tsx");
const control = read(
  "app/portal/supervisor/edit-providers/[clientId]/CareTeamBackControl.tsx"
);

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

function trustedState(clientId = "client-a") {
  const grid = navigation.gridNavigationProvenance(
    "supervisor",
    "dashboard-root",
    clientId
  );
  const orbit = navigation.orbitNavigationProvenance(grid, clientId);
  return {
    [navigation.SUPERVISOR_DASHBOARD_HISTORY_KEY]: {
      mode: "orbit",
      activeClientId: clientId,
      navigation: orbit,
      careTeamOrigin: navigation.careTeamDashboardOrigin(orbit, clientId),
    },
  };
}

test("authorized primary Care Team activation performs one framework navigation and closes once", () => {
  const calls = { prevented: 0, closed: 0, navigated: [] };
  const handled = navigation.runCareTeamLinkNavigation({
    event: {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => { calls.prevented += 1; },
    },
    clientId: "client / one",
    closeMenu: () => { calls.closed += 1; },
    navigate: (href) => { calls.navigated.push(href); },
  });

  assert.equal(handled, true);
  assert.equal(calls.prevented, 1);
  assert.equal(calls.closed, 1);
  assert.deepEqual(calls.navigated, [
    "/portal/supervisor/edit-providers/client%20%2F%20one",
  ]);
});

test("missing Dashboard provenance cannot suppress authorized Care Team navigation", () => {
  const destinations = [];
  navigation.runCareTeamLinkNavigation({
    event: {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() {},
    },
    clientId: "client-a",
    closeMenu() {},
    navigate: (href) => destinations.push(href),
  });
  assert.deepEqual(destinations, [
    "/portal/supervisor/edit-providers/client-a",
  ]);
});

test("modified Care Team activation retains native Link navigation", () => {
  let prevented = false;
  let closed = 0;
  let navigated = 0;
  const handled = navigation.runCareTeamLinkNavigation({
    event: {
      button: 0,
      metaKey: true,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault: () => { prevented = true; },
    },
    clientId: "client-a",
    closeMenu: () => { closed += 1; },
    navigate: () => { navigated += 1; },
  });
  assert.equal(handled, false);
  assert.equal(prevented, false);
  assert.equal(closed, 1);
  assert.equal(navigated, 0);
});

test("Dashboard prepares trusted provenance without substituting raw pushState for routing", () => {
  const state = trustedState();
  const careTeamHandler = dashboard.slice(
    dashboard.indexOf("const prepareCareTeamNavigation"),
    dashboard.indexOf("const handleEntryRead")
  );
  assert.equal(
    navigation.hasTrustedCareTeamDashboardOrigin(state, "client-a"),
    true
  );
  assert.match(menu, /runCareTeamLinkNavigation/);
  assert.match(careTeamHandler, /careTeamDashboardOrigin\(layer\?\.navigation, clientId\)/);
  assert.match(careTeamHandler, /router\.push\(/);
  assert.doesNotMatch(careTeamHandler, /history\.pushState/);
});

test("page Back consumes one trusted Care Team layer and restores the Client orbit", () => {
  assert.match(control, /hasTrustedCareTeamDashboardOrigin\(window\.history\.state, clientId\)/);
  assert.match(control, /window\.history\.back\(\);[\s\S]*return;/);
  assert.equal(
    navigation.careTeamDashboardUrl("client / one"),
    "/dashboard?clientId=client%20%2F%20one&view=orbit"
  );
  assert.match(control, /"Back to Client" : "Back to Dashboard"/);
});

test("trusted Care Team navigation adds and consumes exactly one history entry", () => {
  const orbitState = trustedState();
  const history = [{ url: "/dashboard?clientId=client-a&view=orbit", state: orbitState }];
  history.push({
    url: "/portal/supervisor/edit-providers/client-a",
    state: orbitState,
  });

  assert.equal(history.length, 2);
  history.pop();
  assert.equal(history.length, 1);
  assert.equal(history[0].url, "/dashboard?clientId=client-a&view=orbit");
  assert.equal(
    navigation.hasTrustedCareTeamDashboardOrigin(history[0].state, "client-a"),
    true
  );
});

test("Care Team return never uses the legacy Client List route", () => {
  assert.doesNotMatch(page, /Back to Client list|href="\/portal\/supervisor\/edit-providers"/);
  assert.doesNotMatch(control, /portal\/supervisor\/edit-providers/);
  assert.match(page, /<CareTeamBackControl clientId=\{clientId\} \/>/);
});

test("direct-entry fallback replaces the layer with the authorized Client Dashboard orbit", () => {
  assert.equal(
    navigation.hasTrustedCareTeamDashboardOrigin({}, "client-a"),
    false
  );
  assert.match(control, /useRouter\(\)/);
  assert.match(control, /router\.replace\(careTeamDashboardUrl\(clientId\)\)/);
  assert.doesNotMatch(control, /window\.history\.replaceState|router\.push|history\.pushState/);
});

test("invalid, unauthorized, and mismatched Client origins fail closed to Dashboard", () => {
  assert.equal(
    navigation.hasTrustedCareTeamDashboardOrigin(trustedState(), "client-b"),
    false
  );
  assert.match(
    page,
    /hasActiveClientTeamManagerAuthority\(session\.providerId, clientId\)[\s\S]*redirect\("\/dashboard"\)/
  );
  assert.match(page, /if \(!client\) redirect\("\/dashboard"\)/);
});

test("return destinations are fixed internal URLs with no returnTo or open redirect", () => {
  for (const source of [menu, page, control, read("app/dashboard/dashboardNavigation.ts")]) {
    assert.doesNotMatch(
      source,
      /\breturnTo\b|window\.location|location\.assign|location\.replace/
    );
  }
  assert.match(control, /careTeamDashboardUrl\(clientId\)/);
});

test("Care Team navigation preserves shell utilities and independent authorization", () => {
  const shell = read("app/dashboard/DashboardShell.tsx");
  const workspace = read("app/dashboard/DashboardWorkspaceLayout.tsx");
  assert.match(shell, /DashboardWorkspaceLayout|children/);
  assert.match(workspace, /floatingMenu/);
  assert.match(page, /requireCurrentSupervisor\(\)/);
  assert.match(page, /hasActiveClientTeamManagerAuthority/);
  assert.doesNotMatch(page, /providerClient\.(?:create|update|delete)|clientOrganization\.(?:create|update|delete)/);
});
