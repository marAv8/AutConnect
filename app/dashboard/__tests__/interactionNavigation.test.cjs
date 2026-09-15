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

const {
  closeDismissibleMenu,
  openDismissibleMenu,
  runDismissibleMenuAction,
  toggleDismissibleMenu,
} = require(path.join(root, "app/dashboard/dismissibleMenuState.ts"));
const {
  canReturnToDashboardGrid,
  dashboardHistoryLayerMatchesLocation,
  gridNavigationProvenance,
  orbitNavigationProvenance,
} = require(path.join(root, "app/dashboard/dashboardNavigation.ts"));

test.after(() => {
  require.extensions[".ts"] = originalTsLoader;
});

test("one trigger activation opens and the next closes immediately", () => {
  const state = { current: false };
  const changes = [];

  assert.equal(toggleDismissibleMenu(state, (open) => changes.push(open)), true);
  assert.equal(state.current, true);
  assert.equal(toggleDismissibleMenu(state, (open) => changes.push(open)), true);
  assert.equal(state.current, false);
  assert.deepEqual(changes, [true, false]);
});

test("outside and Escape dismissal share an idempotent close operation", () => {
  const state = { current: false };
  const changes = [];
  const onChange = (open) => changes.push(open);

  openDismissibleMenu(state, onChange);
  assert.equal(closeDismissibleMenu(state, onChange), true);
  assert.equal(closeDismissibleMenu(state, onChange), false);
  assert.deepEqual(changes, [true, false]);
});

test("one menu action closes once and executes once", () => {
  const state = { current: false };
  let actionCalls = 0;
  openDismissibleMenu(state, () => {});

  assert.equal(
    runDismissibleMenuAction(state, () => {}, () => {
      actionCalls += 1;
    }),
    true
  );
  assert.equal(
    runDismissibleMenuAction(state, () => {}, () => {
      actionCalls += 1;
    }),
    false
  );
  assert.equal(actionCalls, 1);
});

test("menu dismissal has no browser-history path or competing touch activation", () => {
  const stateSource = read("app/dashboard/dismissibleMenuState.ts");
  const hookSource = read("app/dashboard/useDismissibleMenu.ts");
  const menuSource = read("app/dashboard/SupervisorDashboardMenu.tsx");
  const supervisorSource = read("app/dashboard/SupervisorDashboard.tsx");

  assert.doesNotMatch(
    `${stateSource}\n${hookSource}`,
    /history\.(?:pushState|replaceState|back)/
  );
  assert.doesNotMatch(menuSource, /onTouch|onMouseDown|onPointerDown/);
  assert.match(menuSource, /onClick=\{toggleMenu\}/);
  assert.match(menuSource, /const toggleMenu = \(\) => \{[\s\S]*onToggle\(\)/);
  assert.match(menuSource, /aria-expanded=\{menuOpen\}/);
  assert.match(menuSource, /aria-controls="supervisor-dashboard-more-menu"/);
  assert.match(supervisorSource, /onToggle=\{toggleDashboardMenu\}/);
  assert.doesNotMatch(supervisorSource, /menuOpen:\s*true/);
});

test("outside pointer ignores menu and trigger while Escape restores trigger focus", () => {
  const hookSource = read("app/dashboard/useDismissibleMenu.ts");

  assert.match(hookSource, /triggerRef\.current\?\.contains\(target\)/);
  assert.match(hookSource, /menuRef\.current\?\.contains\(target\)/);
  assert.match(hookSource, /event\.key !== "Escape"/);
  assert.match(hookSource, /triggerRef\.current\?\.focus\(\)/);
  assert.match(hookSource, /removeEventListener\("pointerdown", onPointerDown\)/);
  assert.match(hookSource, /removeEventListener\("keydown", onKeyDown\)/);
});

test("grid to orbit creates one trusted layer and Back/Forward preserve Client identity", () => {
  const grid = gridNavigationProvenance("provider", "root-a", "client-a");
  const orbit = orbitNavigationProvenance(grid, "client-b");
  const history = [grid, orbit];
  let index = 1;

  assert.equal(canReturnToDashboardGrid(history[index], "provider"), true);
  index -= 1;
  assert.equal(history[index].mode, "grid");
  index += 1;
  assert.equal(history[index].mode, "orbit");
  assert.equal(history[index].activeClientId, "client-b");
  assert.equal(history[index].rootId, grid.rootId);
});

test("a restored orbit entry wins over a stale server-side grid snapshot", () => {
  const orbit = orbitNavigationProvenance(
    gridNavigationProvenance("supervisor", "root-restored", "client-a"),
    "client-b"
  );
  const restoredLayer = {
    mode: "orbit",
    activeClientId: "client-b",
    navigation: orbit,
  };

  assert.equal(
    dashboardHistoryLayerMatchesLocation(
      restoredLayer,
      "https://local.test/dashboard?clientId=client-b&view=orbit",
      "https://local.test"
    ),
    true
  );
  assert.equal(
    dashboardHistoryLayerMatchesLocation(
      restoredLayer,
      "https://local.test/dashboard",
      "https://local.test"
    ),
    false
  );
  assert.equal(
    dashboardHistoryLayerMatchesLocation(
      restoredLayer,
      "https://local.test/dashboard?clientId=client-a&view=orbit",
      "https://local.test"
    ),
    false
  );

  for (const controller of [
    read("app/dashboard/ProviderDashboard.tsx"),
    read("app/dashboard/SupervisorDashboard.tsx"),
  ]) {
    assert.match(controller, /useSearchParams/);
    assert.match(controller, /dashboardLocationKey = searchParams\.toString\(\)/);
    assert.equal(
      (controller.match(/dashboardHistoryLayerMatchesLocation\(/g) ?? []).length,
      2
    );
  }
});

test("visible Client List uses trusted Back and an explicit direct-entry fallback", () => {
  const providerSource = read("app/dashboard/ProviderDashboard.tsx");
  const supervisorSource = read("app/dashboard/SupervisorDashboard.tsx");
  const untrustedOrbit = {
    ...orbitNavigationProvenance(
      gridNavigationProvenance("provider", "root-b", "client-a"),
      "client-a"
    ),
    hasGridPredecessor: false,
  };

  assert.equal(canReturnToDashboardGrid(untrustedOrbit, "provider"), false);
  for (const source of [providerSource, supervisorSource]) {
    assert.match(source, /canReturnToDashboardGrid/);
    assert.match(
      source,
      /if \(canReturnToDashboardGrid[\s\S]*?window\.history\.back\(\);[\s\S]*?return;[\s\S]*?window\.history\.replaceState/
    );
    assert.match(source, /\.\.\.window\.history\.state/);
  }
});

test("menu interactions do not participate in the grid/orbit history sequence", () => {
  const supervisorSource = read("app/dashboard/SupervisorDashboard.tsx");
  const menuWiring = supervisorSource.slice(
    supervisorSource.indexOf("const floatingMenu"),
    supervisorSource.indexOf("return (", supervisorSource.indexOf("const floatingMenu"))
  );

  assert.match(menuWiring, /onToggle=\{toggleDashboardMenu\}/);
  assert.match(menuWiring, /onClose=\{closeDashboardMenu\}/);
  assert.doesNotMatch(
    menuWiring,
    /history\.(?:pushState|replaceState|back)/
  );
});
