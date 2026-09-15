/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const ts = require("typescript");

const root = process.cwd();
const originalTsLoader = Module._extensions[".ts"];
const originalTsxLoader = Module._extensions[".tsx"];
const originalLoad = Module._load;

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

const navigation = require(path.join(root, "app/dashboard/dashboardNavigation.ts"));

Module._load = function loadWithUiStubs(request, parent, isMain) {
  if (request === "next/link") {
    return function Link({ href, children, ...props }) {
      return React.createElement("a", { ...props, href }, children);
    };
  }
  if (
    request === "@/app/components/ThemeToggle" ||
    request === "./TeamFocusSignalControl" ||
    request === "./DashboardInboxControl"
  ) {
    return function Stub() {
      return null;
    };
  }
  return originalLoad(request, parent, isMain);
};

const SupervisorDashboardMenu = require(path.join(
  root,
  "app/dashboard/SupervisorDashboardMenu.tsx"
)).default;

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
  Module._extensions[".tsx"] = originalTsxLoader;
  Module._load = originalLoad;
});

test("rendered authorized Care Team action and its primary activation share one exact destination", () => {
  const clientId = "client-a";
  const markup = renderToStaticMarkup(
    React.createElement(SupervisorDashboardMenu, {
      mode: "orbit",
      menuOpen: true,
      administrativeCapabilities: {
        canAccessPlatformAdministration: false,
        canInviteTeam: false,
        canAddClient: false,
        canAttachExistingClient: false,
        canReviewOrganizationInvitations: false,
        canLinkClient: false,
        removableClientIds: [],
        careTeamClientIds: [clientId],
      },
      newCaseSupportRequestCount: 0,
      pendingOrganizationInvitationCount: 0,
      activeClientId: clientId,
      menuRef: { current: null },
      triggerRef: { current: null },
      onToggle() {},
      onClose() {},
      onOpenCareTeam() {},
      onOpenRemoveClient() {},
      onOpenInsights() {},
      onOpenGuide() {},
      currentProviderId: "provider-a",
    })
  );
  const expected = navigation.careTeamDestinationUrl(clientId);

  assert.match(markup, new RegExp(`href="${expected}"`));
  assert.match(markup, />Care Team<\/a>/);

  const navigations = [];
  navigation.runCareTeamLinkNavigation({
    event: {
      button: 0,
      metaKey: false,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      preventDefault() {},
    },
    clientId,
    closeMenu() {},
    navigate: (href) => navigations.push(href),
  });
  assert.deepEqual(navigations, [expected]);
});
