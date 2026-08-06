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
  isTeamFocusVisible,
  teamFocusBusinessDaysElapsed,
} = require("../teamFocusLifecycle.ts");

test("a Friday Team Focus remains through Thursday and expires Friday", () => {
  const friday = "2026-07-31T17:00:00.000Z";

  assert.equal(
    teamFocusBusinessDaysElapsed(friday, "2026-08-06T19:00:00.000Z"),
    5
  );
  assert.equal(
    isTeamFocusVisible(friday, "2026-08-06T19:00:00.000Z"),
    true
  );
  assert.equal(
    isTeamFocusVisible(friday, "2026-08-07T07:00:00.000Z"),
    false
  );
});

test("Saturday and Sunday remain visible without consuming display days", () => {
  const friday = "2026-07-31T17:00:00.000Z";

  assert.equal(
    teamFocusBusinessDaysElapsed(friday, "2026-08-01T19:00:00.000Z"),
    1
  );
  assert.equal(
    teamFocusBusinessDaysElapsed(friday, "2026-08-02T19:00:00.000Z"),
    1
  );
});
