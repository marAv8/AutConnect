/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");
const ts = require("typescript");
const { renderToStaticMarkup } = require("react-dom/server");

function load(relative, environment) {
  const filename = path.join(process.cwd(), relative);
  const output = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const loadedModule = { exports: {} };
  vm.runInNewContext(output, {
    exports: loadedModule.exports, module: loadedModule, process: { env: { NODE_ENV: environment } },
    require: (request) => {
      if (request.endsWith(".css")) return {};
      if (request === "next/font/google") return { Manrope: () => ({ variable: "test-font" }) };
      if (request.includes("dashboardInteractionTraceBootstrap")) return load("app/dashboard/dashboardInteractionTraceBootstrap.ts", environment);
      return require(request);
    },
  });
  return loadedModule.exports;
}

test("production recorder returns no executable diagnostics even if directly called", () => {
  const production = load("app/dashboard/dashboardInteractionTraceBootstrap.ts", "production");
  assert.equal(production.dashboardInteractionTraceBootstrap(), "");
  assert.match(load("app/dashboard/dashboardInteractionTraceBootstrap.ts", "development").dashboardInteractionTraceBootstrap(), /debugInteractions/);
});

test("actual production root omits recorder script while preserving the theme script", () => {
  const root = load("app/layout.tsx", "production").default;
  const markup = renderToStaticMarkup(root({ children: "Synthetic page" }));
  assert.doesNotMatch(markup, /debugInteractions|autconnect-dashboard-interaction-trace|Interaction trace/);
  assert.match(markup, /autconnect-theme/);
});
