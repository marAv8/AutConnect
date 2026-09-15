/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  CLIENT_ORBIT_MAX_SCALE,
  CLIENT_ORBIT_LAYOUT,
  providerOrbitPoint,
  resolveProviderActionPopoverPosition,
  responsiveClientOrbitScale,
} = require("../clientOrbitLayout.ts");

test("preserves the established client orbit dimensions", () => {
  assert.deepEqual(CLIENT_ORBIT_LAYOUT, {
    orbitSize: 430,
    providerDistance: 144,
    clientBadgeSize: 150,
    providerBadgeSize: 88,
    actionBadgeSize: 28,
  });
});

test("positions four providers at the existing cardinal points", () => {
  const points = Array.from({ length: 4 }, (_, index) =>
    providerOrbitPoint(index, 4, CLIENT_ORBIT_LAYOUT.providerDistance)
  );

  assert.deepEqual(points, [
    { x: 0, y: -144 },
    { x: 144, y: 0 },
    { x: 0, y: 144 },
    { x: -144, y: 0 },
  ]);
});

test("uses deterministic circular placement beyond the curated layouts", () => {
  const point = providerOrbitPoint(0, 9, 144);
  assert.ok(Math.abs(point.x) < Number.EPSILON * 144);
  assert.equal(point.y, -144);
});

test("preserves phone geometry while scaling wider stages as one bounded system", () => {
  const phone = responsiveClientOrbitScale(390, 700);
  const portraitTablet = responsiveClientOrbitScale(744, 850);
  const landscape = responsiveClientOrbitScale(1200, 600);
  const desktop = responsiveClientOrbitScale(1200, 900);

  assert.equal(phone, 390 / CLIENT_ORBIT_LAYOUT.orbitSize);
  assert.ok(portraitTablet > 1 && portraitTablet < landscape);
  assert.ok(landscape > 1 && landscape < desktop);
  assert.equal(desktop, CLIENT_ORBIT_MAX_SCALE);
});

test("limited landscape height constrains the full orbit before width can overscale it", () => {
  const limited = responsiveClientOrbitScale(1200, 540);
  const tall = responsiveClientOrbitScale(1200, 900);

  assert.equal(
    limited,
    (540 - 80) / CLIENT_ORBIT_LAYOUT.orbitSize
  );
  assert.ok(limited < tall);
});

test("an uninitialized block measurement cannot collapse the orbit", () => {
  const scale = responsiveClientOrbitScale(980, 0);
  assert.ok(scale >= 1);
  assert.ok(scale <= CLIENT_ORBIT_MAX_SCALE);
});

test("Provider popovers stay in the viewport and flip around their trigger", () => {
  const below = resolveProviderActionPopoverPosition(
    { left: 430, right: 458, top: 180, bottom: 208 },
    { width: 1024, height: 768 }
  );
  const above = resolveProviderActionPopoverPosition(
    { left: 1180, right: 1208, top: 720, bottom: 748 },
    { width: 1280, height: 800 }
  );

  assert.equal(below.top, 220);
  assert.equal(below.left, 118);
  assert.equal(below.transformOrigin, "top right");
  assert.equal(above.bottom, 92);
  assert.equal(above.transformOrigin, "bottom right");
  assert.equal(above.left, 868);
  assert.ok(below.maxHeight <= 768 - 16);
  assert.ok(above.maxHeight <= 800 - 16);
});
