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
const createEntrySource = fs.readFileSync(
  require.resolve("../../actions/createEntry.ts"),
  "utf8"
);
const updateOwnEntrySource = fs.readFileSync(
  require.resolve("../../actions/updateOwnEntry.ts"),
  "utf8"
);
const completeSessionNoteSource = fs.readFileSync(
  require.resolve("../../actions/completeSessionNote.ts"),
  "utf8"
);

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

test("caregiver context is immediately complete while provider drafts are unchanged", () => {
  assert.equal(statusAfterEntrySave(null, 0, true), "COMPLETED");
  assert.equal(statusAfterEntrySave("IN_PROGRESS", 0, true), "COMPLETED");
  assert.equal(statusAfterEntrySave(null, 0, false), "IN_PROGRESS");
});

test("caregiver context actions use immediate completion and skip session completion", () => {
  assert.match(
    createEntrySource,
    /statusAfterEntrySave\([\s\S]*?isCaretakerContext\s*\)/
  );
  assert.match(
    updateOwnEntrySource,
    /statusAfterEntrySave\([\s\S]*?isCaretakerContext\s*\)/
  );
  assert.match(
    completeSessionNoteSource,
    /session\.role === "Caregiver"[\s\S]*?reason: "not_applicable"/
  );
});
