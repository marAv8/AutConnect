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
      target: ts.ScriptTarget.ES2021,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { statusAfterEntrySave } = require("../entryLifecycle.ts");

test("a first draft save remains in progress", () => {
  assert.equal(statusAfterEntrySave(null, 0), "IN_PROGRESS");
  assert.equal(statusAfterEntrySave("IN_PROGRESS", 0), "IN_PROGRESS");
});

test("editing a completed entry keeps it completed", () => {
  assert.equal(statusAfterEntrySave("COMPLETED", 1), "COMPLETED");
});

test("revision history repairs a legacy completed entry mislabeled in progress", () => {
  assert.equal(statusAfterEntrySave("IN_PROGRESS", 1), "COMPLETED");
});
