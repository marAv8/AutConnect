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
  CLIENT_ORBIT_LAYOUT,
  providerOrbitPoint,
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
