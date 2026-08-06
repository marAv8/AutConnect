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

const { formatRevisionUpdate } = require("../noteHistoryRevision.ts");

test("shows only the updated target rather than the complete target list", () => {
  const before = [
    "Imitation: 1",
    "Transitions: 2",
    "Manding: 3",
  ];
  const after = [
    "Imitation: 1",
    "Transitions: 2 — Observation: Used a puzzle during the transition.",
    "Manding: 3",
  ];

  assert.equal(
    formatRevisionUpdate(before, after),
    "Transitions: 2 — Observation: Used a puzzle during the transition."
  );
});

test("shows the new scalar value without repeating the old value", () => {
  assert.equal(
    formatRevisionUpdate(
      "Maximum prompting",
      "Minimal prompting"
    ),
    "Minimal prompting"
  );
});

test("describes a removed value without displaying crossed-out content", () => {
  assert.equal(formatRevisionUpdate("Old note", null), "Removed");
});

test("hides a target list that was only reordered", () => {
  const before = [
    "Following Directions: 1",
    "Attention: 2",
    "Writing: 3",
  ];
  const after = [
    "Writing: 3",
    "Following Directions: 1",
    "Attention: 2",
  ];

  assert.equal(formatRevisionUpdate(before, after), null);
});
