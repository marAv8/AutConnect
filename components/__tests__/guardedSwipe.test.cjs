/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

const root = process.cwd();
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

const {
  isWithinSwipeEdgeGuard,
  resolveSwipeAxis,
  resolveSwipeDirection,
} = require(path.join(root, "components/useGuardedSwipe.ts"));

test.after(() => {
  Module._extensions[".ts"] = originalTsLoader;
});

test("axis locking preserves vertical movement and ignores small movement", () => {
  assert.equal(resolveSwipeAxis(null, 7, 1), null);
  assert.equal(resolveSwipeAxis(null, 10, 18), "vertical");
  assert.equal(resolveSwipeAxis("vertical", 80, 2), "vertical");
  assert.equal(resolveSwipeAxis(null, -30, 4), "horizontal");
});

test("threshold and Client boundaries resolve at most one navigation direction", () => {
  const direction = (overrides = {}) =>
    resolveSwipeDirection({
      axis: "horizontal",
      deltaX: -80,
      deltaY: 3,
      threshold: 56,
      canSwipeLeft: true,
      canSwipeRight: true,
      ...overrides,
    });

  assert.equal(direction(), "left");
  assert.equal(direction({ deltaX: 80 }), "right");
  assert.equal(direction({ deltaX: -55 }), null);
  assert.equal(direction({ deltaX: -80, deltaY: 75 }), null);
  assert.equal(direction({ canSwipeLeft: false }), null);
  assert.equal(direction({ deltaX: 80, canSwipeRight: false }), null);
});

test("the Dashboard edge strip remains available to browser navigation", () => {
  assert.equal(isWithinSwipeEdgeGuard(24, 390, 24), true);
  assert.equal(isWithinSwipeEdgeGuard(25, 390, 24), false);
  assert.equal(isWithinSwipeEdgeGuard(366, 390, 24), true);
  assert.equal(isWithinSwipeEdgeGuard(365, 390, 24), false);
});

test("Dashboard integration allows only the central touch target", () => {
  const carousel = fs.readFileSync(
    path.join(root, "app/dashboard/ClientCarousel.tsx"),
    "utf8"
  );
  const orbit = fs.readFileSync(
    path.join(root, "app/dashboard/ClientOrbit.tsx"),
    "utf8"
  );

  assert.match(orbit, /<button\s[\s\S]*?className="client-orbit-center-hit-target"[^>]*data-swipe-allow="true"/);
  assert.equal((orbit.match(/data-swipe-allow="true"/g) || []).length, 1);
  assert.match(orbit, /className="glass-client-badge dashboard-arrival-client-visual"/);
  assert.match(orbit, /className=\{`provider-orbit-node[\s\S]*data-swipe-ignore="true"/);
  assert.match(carousel, /edgeGuard: DASHBOARD_BROWSER_EDGE_GUARD_PX/);
  assert.match(carousel, /blockingSelector: DASHBOARD_SWIPE_BLOCKING_SELECTOR/);
  assert.match(carousel, /disabled: overlayType !== null/);
});
