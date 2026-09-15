/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const layout = read("app/dashboard/DashboardWorkspaceLayout.tsx");
const styles = read("app/globals.css");
const supervisorMenu = read("app/dashboard/SupervisorDashboardMenu.tsx");
const supervisorDashboard = read("app/dashboard/SupervisorDashboard.tsx");
const providerDashboard = read("app/dashboard/ProviderDashboard.tsx");
const header = read("app/components/AuthenticatedPageHeader.tsx");
const inbox = read("app/dashboard/DashboardInboxControl.tsx");

test("the dashboard utility group owns one reserved footer row in the shared stage", () => {
  assert.match(layout, /className="dashboard-utility-dock"/);
  assert.doesNotMatch(layout, /position: "absolute"[\s\S]*floatingMenu/);
  assert.match(layout, /className="dashboard-utility-footer-region"/);
  assert.match(styles, /\.dashboard-utility-footer-region \{[\s\S]*position: fixed;[\s\S]*bottom: max\(var\(--dashboard-dock-edge-gap\), env\(safe-area-inset-bottom\)\)/);
  assert.match(layout, /className="dashboard-utility-footer-region"[\s\S]*className="dashboard-stage-coordinate"/);
  assert.match(styles, /env\(safe-area-inset-left\)/);
  assert.match(styles, /env\(safe-area-inset-bottom\)/);
  assert.match(styles, /\.dashboard-shared-shell \{[\s\S]*position: fixed;[\s\S]*inset: 0;[\s\S]*height: 100dvh;[\s\S]*overflow: hidden/);
  assert.doesNotMatch(styles, /100vh - 100dvh|address-bar|localhost/);
  assert.equal((layout.match(/className="dashboard-utility-dock"/g) ?? []).length, 1);
  assert.match(supervisorDashboard, /<DashboardWorkspaceLayout/);
  assert.match(providerDashboard, /<DashboardWorkspaceLayout/);
});

test("dashboard content ends before utilities without changing utility behavior", () => {
  assert.match(styles, /\.dashboard-workspace-layout \{[\s\S]*display: flex;[\s\S]*flex: 1 1 auto/);
  assert.match(styles, /\.dashboard-client-stage-region \{[\s\S]*overflow: hidden/);
  assert.match(styles, /\.dashboard-workspace-layout \{[\s\S]*padding-bottom: calc\([\s\S]*--dashboard-dock-hit-size[\s\S]*safe-area-inset-bottom/);
  assert.match(supervisorMenu, /aria-label="More"/);
  assert.match(supervisorMenu, /<DashboardInboxControl/);
  assert.match(inbox, /href="\/portal\/case-support\/requests"/);
  assert.match(supervisorMenu, /<ThemeToggle \/>/);
  assert.match(providerDashboard, /className="dashboard-utility-controls"/);
  assert.doesNotMatch(header, /Organization Invitations/);
  assert.match(inbox, /Organization Invitations/);
});

test("expanded More menu remains above the dock while confirmations remain authoritative", () => {
  assert.match(supervisorMenu, /<DashboardActionSurface/);
  assert.match(styles, /\.dashboard-action-surface \{[\s\S]*bottom: calc\(100% \+ var\(--dashboard-menu-viewport-gap\)\)/);
  assert.match(styles, /\.dashboard-action-surface-scroll \{[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain/);
  assert.match(styles, /\.provider-action-menu-backdrop[\s\S]*z-index: 89/);
  assert.match(styles, /\.dashboard-utility-footer-region \{[\s\S]*z-index: 90/);
  assert.match(styles, /\.provider-action-menu \{[\s\S]*z-index: 91 !important/);
  assert.match(styles, /--dashboard-action-sheet-max-height: min\(62dvh, 520px\)/);
  assert.match(styles, /\.provider-action-menu \{[\s\S]*max-height: var\(--dashboard-action-sheet-max-height\) !important/);
  assert.match(styles, /\.dashboard-action-surface \{[\s\S]*max-height: var\(--dashboard-action-sheet-max-height\)/);
  assert.match(supervisorDashboard, /zIndex: 130/);
});
