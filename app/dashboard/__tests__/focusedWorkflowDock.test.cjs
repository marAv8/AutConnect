/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const test = require("node:test");
const ts = require("typescript");

const root = process.cwd();
const statePath = path.join(root, "app/dashboard/dashboardOverlayState.ts");
const carouselSource = fs.readFileSync(
  path.join(root, "app/dashboard/ClientCarousel.tsx"),
  "utf8"
);
const styles = fs.readFileSync(path.join(root, "app/globals.css"), "utf8");
const originalTsLoader = Module._extensions[".ts"];
const originalTsxLoader = Module._extensions[".tsx"];

function loadTypeScript(module, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
}

Module._extensions[".ts"] = loadTypeScript;
Module._extensions[".tsx"] = loadTypeScript;

const { isDashboardFocusedDataEntry } = require(statePath);
const DashboardWorkspaceLayout =
  require(path.join(root, "app/dashboard/DashboardWorkspaceLayout.tsx")).default;

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
  Module._extensions[".tsx"] = originalTsxLoader;
});

test("only focused Dashboard reading and data-entry overlays suppress utilities", () => {
  for (const overlay of ["view", "add", "update", "abc", "teamFocus", "teamFocusView", "educatorTarget"]) {
    assert.equal(isDashboardFocusedDataEntry(overlay), true, overlay);
  }

  for (const overlay of [null, "clientHandoff"]) {
    assert.equal(isDashboardFocusedDataEntry(overlay), false, String(overlay));
  }
});

test("focused state removes utility controls from rendered workspace markup", () => {
  const renderWorkspace = (overlayType) =>
    renderToStaticMarkup(
      React.createElement(DashboardWorkspaceLayout, {
        topNav: null,
        content: React.createElement("div", null, "Client stage"),
        floatingMenu: React.createElement(
          "button",
          { type: "button", "data-utility-action": "true" },
          "More"
        ),
        utilitiesHidden: isDashboardFocusedDataEntry(overlayType),
      })
    );

  for (const overlay of ["view", "add", "update", "abc", "teamFocus", "teamFocusView", "educatorTarget"]) {
    const markup = renderWorkspace(overlay);
    assert.doesNotMatch(markup, /data-dashboard-shell-region="utility-dock"/, overlay);
    assert.doesNotMatch(markup, /data-utility-action="true"/, overlay);
    assert.match(markup, /dashboard-workspace-layout--without-utilities/, overlay);
  }

  for (const overlay of [null, "clientHandoff"]) {
    const markup = renderWorkspace(overlay);
    assert.match(markup, /data-dashboard-shell-region="utility-dock"/, String(overlay));
    assert.match(markup, /data-utility-action="true"/, String(overlay));
    assert.doesNotMatch(
      markup,
      /dashboard-workspace-layout--without-utilities/,
      String(overlay)
    );
  }
});

test("View Notes keeps utilities absent through nested records and restores them on return", () => {
  const journey = [
    { screen: "orbit", overlayType: null, nestedRecord: null, dockExpected: true },
    { screen: "note history", overlayType: "view", nestedRecord: null, dockExpected: false },
    { screen: "Clinical Note", overlayType: "view", nestedRecord: "clinical", dockExpected: false },
    { screen: "Updates", overlayType: "view", nestedRecord: "updates", dockExpected: false },
    { screen: "Timestamp", overlayType: "view", nestedRecord: "timestamp", dockExpected: false },
    { screen: "orbit", overlayType: null, nestedRecord: null, dockExpected: true },
  ];

  for (const step of journey) {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardWorkspaceLayout, {
        topNav: null,
        content: React.createElement(
          "div",
          { "data-note-history-screen": step.screen },
          step.nestedRecord
            ? React.createElement("details", { open: true }, step.nestedRecord)
            : "Client orbit"
        ),
        floatingMenu: React.createElement(
          "button",
          { type: "button", "data-utility-action": "true" },
          "More"
        ),
        utilitiesHidden: isDashboardFocusedDataEntry(step.overlayType),
      })
    );

    assert.equal(
      markup.includes('data-dashboard-shell-region="utility-dock"'),
      step.dockExpected,
      step.screen
    );
    assert.equal(
      markup.includes('data-utility-action="true"'),
      step.dockExpected,
      step.screen
    );
    assert.equal(
      markup.includes("dashboard-workspace-layout--without-utilities"),
      !step.dockExpected,
      step.screen
    );
  }
});

test("Team Focus reading removes utilities and restores them after every reopen", () => {
  const journey = [null, "teamFocusView", null, "teamFocusView", null];

  for (const overlayType of journey) {
    const markup = renderToStaticMarkup(
      React.createElement(DashboardWorkspaceLayout, {
        topNav: null,
        content: React.createElement("div", null, overlayType ?? "Client orbit"),
        floatingMenu: React.createElement(
          "button",
          { type: "button", "data-utility-action": "true" },
          "More"
        ),
        utilitiesHidden: isDashboardFocusedDataEntry(overlayType),
      })
    );
    const dockExpected = overlayType === null;

    assert.equal(
      markup.includes('data-dashboard-shell-region="utility-dock"'),
      dockExpected,
      String(overlayType)
    );
    assert.equal(markup.includes('data-utility-action="true"'), dockExpected);
  }
});

test("carousel focus state is propagated to both dashboard dock owners", () => {
  const orbitSource = fs.readFileSync(
    path.join(root, "app/dashboard/OrbitView.tsx"),
    "utf8"
  );
  const providerSource = fs.readFileSync(
    path.join(root, "app/dashboard/ProviderDashboard.tsx"),
    "utf8"
  );
  const supervisorSource = fs.readFileSync(
    path.join(root, "app/dashboard/SupervisorDashboard.tsx"),
    "utf8"
  );

  assert.match(
    carouselSource,
    /onFocusedDataEntryChange\?\.\(focusedDataEntry\)/
  );
  assert.match(orbitSource, /onFocusedDataEntryChange=\{onFocusedDataEntryChange\}/);
  for (const source of [providerSource, supervisorSource]) {
    assert.match(source, /onFocusedDataEntryChange=\{setFocusedDataEntry\}/);
    assert.match(source, /utilitiesHidden=\{focusedDataEntry\}/);
  }
  assert.match(
    styles,
    /\.dashboard-workspace-layout--without-utilities \{\s*padding-bottom: 0;/
  );
  assert.doesNotMatch(styles, /dashboard-workspace-layout:has/);
});
