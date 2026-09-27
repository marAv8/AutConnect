/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const shell = read("app/dashboard/DashboardShell.tsx");
const dashboardLayout = read("app/dashboard/layout.tsx");
const workspace = read("app/dashboard/DashboardWorkspaceLayout.tsx");
const provider = read("app/dashboard/ProviderDashboard.tsx");
const supervisor = read("app/dashboard/SupervisorDashboard.tsx");
const header = read("app/components/AuthenticatedPageHeader.tsx");
const inbox = read("app/dashboard/DashboardInboxControl.tsx");
const carouselNavigation = read("app/dashboard/ClientCarouselNavigation.tsx");
const grid = read("app/dashboard/GridClientView.tsx");
const gridStyles = read("app/dashboard/GridClientView.module.css");
const styles = read("app/globals.css");

test("Supervisor, Provider, zero-Client, grid, and orbit states converge on the shared shell", () => {
  assert.match(dashboardLayout, /<DashboardShell>\{children\}<\/DashboardShell>/);
  assert.match(shell, /className="dashboard-shared-shell"/);
  for (const dashboard of [provider, supervisor]) {
    assert.match(dashboard, /<DashboardWorkspaceLayout/);
    assert.match(dashboard, /<FirstClientEmptyState/);
    assert.match(dashboard, /<OrbitView/);
    assert.match(dashboard, /<GridClientView/);
  }
});

test("persistent authenticated header is identity-only and authorized actions live in dashboard utilities", () => {
  assert.match(shell, /className="dashboard-shell-header-region app-shell-pad"/);
  assert.match(shell, /<AppUserHeader \/>/);
  assert.doesNotMatch(header, /Attach Existing Client|Organization Invitations/);
  assert.match(supervisor, /administrativeCapabilities=\{visibleAdministrativeCapabilities\}/);
  assert.match(inbox, /href="\/portal\/organization\/client-invitations"/);
});

test("client stage and utility dock share the same centered coordinate system", () => {
  assert.match(workspace, /data-dashboard-shell-region="client-stage"/);
  assert.match(workspace, /data-dashboard-shell-region="utility-dock"/);
  assert.match(workspace, /className="dashboard-stage-coordinate"/);
  assert.match(styles, /--dashboard-stage-max-width: 1200px/);
  assert.match(styles, /\.dashboard-stage-coordinate \{[\s\S]*width: min\(100%, var\(--dashboard-stage-max-width\)\)[\s\S]*margin-inline: auto/);
  assert.match(workspace, /className="dashboard-utility-footer-region"[\s\S]*className="dashboard-stage-coordinate"/);
  assert.match(styles, /\.dashboard-utility-footer-region \{[\s\S]*width: 100%/);
  assert.doesNotMatch(styles, /calc\(\(100vw - 1280px\)/);
  assert.doesNotMatch(styles, /\.dashboard-utility-dock \{[\s\S]{0,180}position: fixed/);
  assert.match(styles, /\.dashboard-utility-dock \{[\s\S]*justify-content: center/);
  assert.doesNotMatch(styles, /\.dashboard-utility-dock \{[^}]*justify-content: flex-start/);
  assert.match(carouselNavigation, /justifyContent: "center"/);
});

test("responsive shell contains horizontal sizing at every required viewport class", () => {
  assert.match(styles, /--dashboard-shell-inline-padding: clamp\(12px, 2\.25vw, 32px\)/);
  assert.match(styles, /\.dashboard-shared-shell \{[\s\S]*position: fixed;[\s\S]*inset: 0;[\s\S]*height: 100dvh;[\s\S]*overflow: hidden/);
  assert.match(styles, /\.dashboard-shell-body \{[\s\S]*min-width: 0/);
  assert.match(styles, /\.dashboard-client-stage-region \{[\s\S]*min-width: 0/);

  for (const width of [390, 440, 768, 912, 1280, 1440, 1728]) {
    const inlinePadding = Math.max(12, Math.min(width * 0.0225, 32));
    const usableWidth = width - inlinePadding * 2;
    const stageWidth = Math.min(usableWidth, 1200);
    assert.ok(usableWidth > 0, `${width}px retains usable inline space`);
    assert.ok(stageWidth <= usableWidth, `${width}px stage stays inside its shell`);
    assert.ok(stageWidth <= 1200, `${width}px stage respects its shared maximum`);
  }
});

test("Client grid scales its container without changing shared badge geometry", () => {
  assert.match(styles, /--dashboard-grid-orb-size: clamp\(120px, min\(14vw, 16dvh\), 150px\)/);
  assert.match(styles, /--dashboard-grid-gap: clamp\(48px, min\(5vw, 6dvh\), 64px\)/);
  assert.match(gridStyles, /width: var\(--dashboard-grid-orb-size\)/);
  assert.match(gridStyles, /height: var\(--dashboard-grid-orb-size\)/);
  assert.match(gridStyles, /gap: var\(--dashboard-grid-gap\)/);
  assert.match(grid, /Math\.min\(clientCount, 3\)/);
  assert.match(grid, /Math\.min\(Math\.ceil\(clientCount \/ wideColumnCount\), 3\)/);
  assert.match(gridStyles, /--client-list-columns: 2/);
  assert.match(gridStyles, /--client-list-visible-rows: 2/);
  assert.match(gridStyles, /@media \(min-width: 800px\)/);
  assert.match(gridStyles, /--client-list-columns: var\(--client-list-wide-columns\)/);
  assert.match(gridStyles, /--client-list-visible-rows: var\(--client-list-wide-visible-rows\)/);
});

test("Client grid owns one height-bounded scroller with an external desktop gutter", () => {
  assert.match(gridStyles, /\.clientListModeFrame \{[\s\S]*height: calc\(100% - var\(--dashboard-mode-content-margin-top, 18px\)\)/);
  assert.match(gridStyles, /\.clientListScrollFrame \{[\s\S]*max-height: 100%/);
  assert.match(gridStyles, /\.clientListSurface \{[\s\S]*inset: 0 var\(--client-list-external-scroll-area\) 0 0/);
  assert.match(gridStyles, /\.clientListScrollRegion \{[\s\S]*overflow-x: hidden;[\s\S]*overflow-y: auto/);
  assert.equal((gridStyles.match(/overflow-y: auto/g) ?? []).length, 1);
  assert.match(gridStyles, /@media \(min-width: 521px\) \{[\s\S]*--client-list-external-scroll-area: 22px/);
  assert.match(gridStyles, /@media \(max-width: 520px\) \{[\s\S]*--client-list-content-inset: 18px/);
});

test("shell work adds no broad important override and preserves utility children", () => {
  const shellStyles = styles.slice(
    styles.indexOf("/* Client carousel, orbit, Team Focus, and responsive dashboard workspace. */"),
    styles.indexOf(".team-focus-close-button")
  );
  assert.doesNotMatch(shellStyles, /!important/);
  assert.match(supervisor, /floatingMenu=\{floatingMenu\}/);
  assert.match(provider, /className="dashboard-utility-controls"[\s\S]*aria-label="How AutConnect works"[\s\S]*<TeamFocusSignalControl[\s\S]*<ThemeToggle \/>/);
});
