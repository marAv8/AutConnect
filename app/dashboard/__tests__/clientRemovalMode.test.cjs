/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
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

const { applySuccessfulClientRemoval } = require(path.join(
  root,
  "app/dashboard/clientRemovalMode.ts"
));
const supervisor = read("app/dashboard/SupervisorDashboard.tsx");
const grid = read("app/dashboard/GridClientView.tsx");
const gridStyles = read("app/dashboard/GridClientView.module.css");
const action = read("app/actions/manageSupervisorClients.ts");

test.after(() => {
  require.extensions[".ts"] = originalTsLoader;
});

test("successful removal updates only the selected badge and preserves active identity when possible", () => {
  const clients = [{ id: "a" }, { id: "b" }, { id: "c" }];

  assert.deepEqual(applySuccessfulClientRemoval(clients, "a", "b"), {
    remainingClients: [{ id: "a" }, { id: "c" }],
    activeClientId: "a",
  });
  assert.deepEqual(applySuccessfulClientRemoval(clients, "b", "b"), {
    remainingClients: [{ id: "a" }, { id: "c" }],
    activeClientId: "a",
  });
  assert.deepEqual(applySuccessfulClientRemoval([{ id: "a" }], "a", "a"), {
    remainingClients: [],
    activeClientId: undefined,
  });
});

test("browse and removal modes reuse one mounted grid, surface, and scroll region", () => {
  assert.match(supervisor, /mode === "grid" \|\| mode === "remove"/);
  assert.match(supervisor, /<GridClientView[\s\S]*removalMode=\{mode === "remove"\}/);
  assert.doesNotMatch(supervisor, /RemoveClientView/);
  assert.match(grid, /className=\{styles\.clientListScrollFrame\}/);
  assert.match(grid, /className=\{styles\.clientListSurface\}/);
  assert.match(grid, /className=\{`\$\{styles\.clientListScrollRegion\}/);
  assert.doesNotMatch(grid, /key=\{removalMode/);
  assert.doesNotMatch(supervisor, /mode === "remove"[\s\S]{0,220}>\s*Client List/);
});

test("removal controls are capability-scoped, accessible, and isolated from badge activation", () => {
  assert.match(grid, /const canRemove = removableClientIdSet\.has\(client\.id\)/);
  assert.match(grid, /removalMode && canRemove && onRemoveClient/);
  assert.match(grid, /aria-label=\{`Remove \$\{clientName\} from your Dashboard`\}/);
  assert.match(grid, /disabled=\{removalMode\}/);
  assert.match(grid, /event\.stopPropagation\(\);[\s\S]*onRemoveClient\(client\.id, clientName\)/);
  assert.match(gridStyles, /\.removeClientControl \{[\s\S]*width: 44px;[\s\S]*height: 44px/);
  assert.match(gridStyles, /\.removeClientControl::before \{[\s\S]*width: 30px;[\s\S]*height: 30px/);
});

test("outside tap and Escape exit the single removal history layer without moving the grid", () => {
  const menu = read("app/dashboard/SupervisorDashboardMenu.tsx");
  assert.doesNotMatch(grid, /removalDoneControl|>\s*Done\s*</);
  assert.match(grid, /data-client-grid-mode=\{removalMode \? "remove" : "browse"\}/);
  assert.match(supervisor, /onContentPointerDown=\{\(event\) => \{/);
  assert.match(supervisor, /event\.target\.closest\('\[data-client-grid-mode="remove"\]'\)/);
  assert.match(supervisor, /pendingClientAction[\s\S]*returnOneDashboardLayer\(\)/);
  assert.match(supervisor, /event\.key !== "Escape"[\s\S]*returnOneDashboardLayer\(\)/);
  assert.match(supervisor, /pushDashboardLayer\(\{[\s\S]*mode: "remove"/);
  assert.match(supervisor, /layer && \(layer\.mode !== "grid" \|\| layer\.insightsOpen\)[\s\S]*window\.history\.back\(\)/);
  assert.doesNotMatch(grid, /history\.|router\.|location\./);
  assert.match(menu, /mode !== "remove" &&[\s\S]*removableClientIds\.length > 0/);
});

test("confirmation cancellation and pending state retain removal mode and prevent duplicates", () => {
  assert.match(supervisor, /if \(!action \|\| busyClientId\) return/);
  assert.match(supervisor, /await onRemoveClient\(action\.clientId\);\s*setPendingClientAction\(null\)/);
  assert.match(supervisor, /busy=\{busyClientId === pendingClientAction\.clientId\}/);
  assert.match(supervisor, /disabled=\{busy\}[\s\S]*Working\.\.\./);
  assert.match(supervisor, /if \(!busy\) onCancel\(\)/);
  assert.match(supervisor, /onCancel=\{\(\) => setPendingClientAction\(null\)\}/);
  const removalHandler = supervisor.slice(
    supervisor.indexOf("const onRemoveClient"),
    supervisor.indexOf("const confirmPendingClientAction")
  );
  assert.doesNotMatch(removalHandler, /returnOneDashboardLayer/);
  assert.match(removalHandler, /setClientActionError/);
});

test("server removal remains a current-Supervisor soft revocation with historical data untouched", () => {
  assert.match(action, /requireCurrentSupervisor\(\)/);
  assert.match(action, /providerId: supervisor\.id, revokedAt: null/);
  assert.match(action, /revocationReason: "SUPERVISOR_LEFT_CLIENT"/);
  assert.match(action, /action: "PROVIDER_REVOKED"/);
  assert.doesNotMatch(
    action,
    /client\.(?:delete|deleteMany)|entry\.(?:delete|deleteMany)|goalDefinition\.(?:delete|deleteMany)|assessmentItem\.(?:delete|deleteMany)/
  );
});
