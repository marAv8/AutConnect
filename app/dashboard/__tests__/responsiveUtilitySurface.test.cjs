/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const styles = read("app/globals.css");
const surface = read("app/dashboard/DashboardActionSurface.tsx");
const supervisor = read("app/dashboard/SupervisorDashboardMenu.tsx");
const provider = read("app/dashboard/ProviderDashboardMoreMenu.tsx");
const providerOrbit = read("app/dashboard/ClientOrbit.tsx");
const stabilizer = read("app/components/AuthenticatedViewportStabilizer.tsx");
const portalLayout = read("app/portal/layout.tsx");

test("phone dock separates a 39px visible circle from its 44px hit area", () => {
  assert.match(styles, /--dashboard-dock-hit-size: 44px/);
  assert.match(styles, /--dashboard-dock-visible-size: 39px/);
  assert.equal(39 / 52, 0.75);
  assert.match(styles, /\.dashboard-round-icon-control::before \{[\s\S]*--dashboard-dock-visible-size/);
  assert.match(styles, /\.dashboard-round-icon-control \{[\s\S]*overflow: visible/);
});

test("dock follows the dynamic viewport and reserves matching stage clearance", () => {
  assert.match(styles, /\.dashboard-shared-shell \{[\s\S]*position: fixed;[\s\S]*inset: 0;[\s\S]*height: 100dvh/);
  assert.match(styles, /\.dashboard-utility-footer-region \{[\s\S]*position: fixed;[\s\S]*safe-area-inset-bottom/);
  assert.match(styles, /\.dashboard-workspace-layout \{[\s\S]*padding-bottom: calc\([\s\S]*--dashboard-dock-hit-size[\s\S]*--dashboard-dock-content-gap/);
  assert.doesNotMatch(styles, /--dashboard-browser-bottom-clearance|100vh - 100dvh/);
});

test("the complete dock group stays centered at every viewport width", () => {
  assert.match(styles, /\.dashboard-utility-dock \{[\s\S]*justify-content: center/);
  assert.doesNotMatch(styles, /\.dashboard-utility-dock \{[^}]*justify-content: flex-start/);
  assert.doesNotMatch(styles, /\.dashboard-utility-controls \{[^}]*margin-left/);
  assert.match(styles, /--dashboard-stage-max-width: 1200px/);
});

test("Supervisor and Provider More reuse presentation without sharing capability logic", () => {
  assert.match(surface, /Presentation-only action surface/);
  assert.match(supervisor, /<DashboardActionSurface/);
  assert.match(provider, /<DashboardActionSurface/);
  assert.doesNotMatch(surface, /administrativeCapabilities|canAttach|careTeamClientIds|href=/);
  assert.match(supervisor, /careTeamClientIds\.includes/);
});

test("Provider-plus and More consume one canonical surface and row primitive", () => {
  for (const token of [
    "--dashboard-action-row-font-size",
    "--dashboard-action-row-font-weight",
    "--dashboard-action-row-min-height",
  ]) {
    assert.match(styles, new RegExp(`${token}:`));
  }
  assert.match(surface, /dashboard-action-surface-material dashboard-action-surface/);
  assert.match(providerOrbit, /dashboard-action-surface-material provider-action-menu/);
  assert.match(providerOrbit, /className="dashboard-action-row"/);
  assert.doesNotMatch(supervisor, /className="[^"]*(?:action-secondary|action-positive|dashboard-menu-action)[^"]*"/);
  assert.match(styles, /\.dashboard-action-surface-material \.dashboard-action-row \{[\s\S]*border: 0 !important;[\s\S]*background: transparent !important;[\s\S]*box-shadow: none !important/);
  assert.doesNotMatch(providerOrbit, /providerActionMenuStyle|providerActionLinkStyle/);
});

test("Client Administration is the first conditional row and remains one in-surface disclosure", () => {
  const gridBranch = supervisor.slice(
    supervisor.indexOf('mode !== "orbit"'),
    supervisor.indexOf(') : (', supervisor.indexOf('mode !== "orbit"'))
  );
  assert.ok(gridBranch.indexOf("Client Administration") < gridBranch.indexOf("Invite Team"));
  assert.ok(gridBranch.indexOf("Invite Team") < gridBranch.indexOf("How AutConnect Works"));
  assert.match(gridBranch, /hasClientAdministration \? \([\s\S]*dashboard-menu-disclosure-trigger/);
  assert.match(gridBranch, /clientAdministrationOpen \? \([\s\S]*className="dashboard-menu-disclosure"/);
  assert.doesNotMatch(gridBranch, /dashboard-action-surface[^\n]*dashboard-action-surface/);
  assert.doesNotMatch(styles, /\.dashboard-menu-disclosure \{[\s\S]{0,240}position: (?:fixed|absolute)/);
});

test("the canonical material owns the only action-sheet glass tokens", () => {
  for (const token of [
    "--dashboard-action-surface-border",
    "--dashboard-action-surface-background",
    "--dashboard-action-surface-highlight",
    "--dashboard-action-surface-shadow",
    "--dashboard-action-surface-filter",
  ]) {
    assert.match(styles, new RegExp(`\\.dashboard-action-surface-material \\{[\\s\\S]*var\\(${token}\\)`));
    assert.equal((styles.match(new RegExp(`${token}:`, "g")) ?? []).length, 2);
  }
  assert.doesNotMatch(styles, /--provider-action-(?:menu|backdrop)/);
  assert.match(surface, /dashboard-action-backdrop dashboard-action-surface-backdrop/);
  assert.match(providerOrbit, /dashboard-action-backdrop provider-action-menu-backdrop/);
  assert.match(styles, /@media \(prefers-reduced-transparency: reduce\)[\s\S]*dashboard-action-surface-fallback[\s\S]*backdrop-filter: none/);
});

test("peer separators belong to rows while child separators stay inset", () => {
  assert.match(styles, /\.dashboard-action-surface-scroll > \.dashboard-action-row \+ \.dashboard-action-row[\s\S]*--dashboard-action-row-separator/);
  assert.match(styles, /\.dashboard-menu-disclosure > \.dashboard-action-row--child \+ \.dashboard-action-row--child[\s\S]*--dashboard-action-child-separator/);
  assert.doesNotMatch(styles, /\.dashboard-action-row::after[\s\S]*separator/);
  assert.match(providerOrbit, /Field Observation[\s\S]*Clinical Note[\s\S]*(?:Case Support|Open Active Case)[\s\S]*View Notes/);
});

test("both phone sheets share one dock-clearance, inset, height, and layer contract", () => {
  assert.match(styles, /\.dashboard-action-surface \{[\s\S]*position: absolute;[\s\S]*max-height: min\(520px, calc\(100dvh - 112px\)\)/);
  for (const selector of ["dashboard-action-surface", "provider-action-menu"]) {
    const blocks = [...styles.matchAll(new RegExp(`\\.${selector} \\{([^}]+)\\}`, "g"))];
    const phoneBlock = blocks.find((match) => match[1].includes("--dashboard-action-sheet-bottom"));
    assert.ok(phoneBlock, `${selector} must have a phone positioning block`);
    for (const token of [
      "--dashboard-action-sheet-inline-inset",
      "--dashboard-action-sheet-inline-end-inset",
      "--dashboard-action-sheet-bottom",
      "--dashboard-action-sheet-max-height",
    ]) {
      assert.match(phoneBlock[1], new RegExp(token));
    }
  }
  assert.match(styles, /--dashboard-action-sheet-bottom: calc\([\s\S]*--dashboard-dock-hit-size[\s\S]*--dashboard-menu-viewport-gap/);
  assert.match(styles, /\.provider-action-menu-backdrop \{[\s\S]*z-index: 89/);
  assert.match(styles, /\.dashboard-utility-footer-region \{[\s\S]*z-index: 90/);
  assert.match(styles, /\.provider-action-menu \{[\s\S]*z-index: 91 !important/);
  assert.doesNotMatch(styles, /body\.provider-action-menu-open[\s\S]*visibility: hidden/);
  assert.match(styles, /\.dashboard-action-surface-scroll \{[\s\S]*overflow-y: auto/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.provider-action-menu/);
});

test("each sheet owns one backdrop and one bounded content region", () => {
  assert.equal((surface.match(/dashboard-action-backdrop/g) ?? []).length, 1);
  assert.equal(
    (providerOrbit.match(/dashboard-action-backdrop provider-action-menu-backdrop/g) ?? []).length,
    1
  );
  assert.equal((surface.match(/dashboard-action-surface-scroll/g) ?? []).length, 1);
  assert.equal(
    (providerOrbit.match(/className="dashboard-action-surface-scroll"/g) ?? []).length,
    1
  );
  assert.match(styles, /\.dashboard-action-surface-material \{[\s\S]*overflow: hidden/);
  assert.match(styles, /\.dashboard-action-surface-scroll \{[\s\S]*min-height: 0;[\s\S]*overflow-y: auto/);
});

test("larger-screen popovers originate from their own triggers", () => {
  assert.match(styles, /\.dashboard-action-surface \{[\s\S]*bottom: calc\(100% \+ var\(--dashboard-menu-viewport-gap\)\);[\s\S]*left: calc\(var\(--dashboard-dock-hit-size\) \/ 2\)/);
  assert.match(styles, /@keyframes dashboard-action-popover-in/);
  assert.match(providerOrbit, /anchor\.getBoundingClientRect\(\)/);
  assert.match(providerOrbit, /resolveProviderActionPopoverPosition/);
  assert.match(providerOrbit, /window\.visualViewport/);
  assert.match(providerOrbit, /left: providerMenuPosition\.left/);
  assert.match(providerOrbit, /transformOrigin:[\s\S]*providerMenuPosition\.transformOrigin/);
  assert.doesNotMatch(styles, /inset: auto 16px auto auto/);
});

test("Dashboard corrects stale offsets without disabling portal scroll restoration", () => {
  assert.match(stabilizer, /window\.scrollTo\(0, 0\)/);
  assert.doesNotMatch(stabilizer, /scrollRestoration/);
  assert.doesNotMatch(portalLayout, /AuthenticatedViewportStabilizer/);
});
