/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
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

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "@/lib/sessionScoring") {
    return { normalizeItem: () => null };
  }
  if (request === "@/app/libs/dateTime") {
    return { formatClinicalDateTime: () => "Jul 28, 2026, 9:15 PM" };
  }
  if (request === "@/app/libs/entryRevision") {
    return { buildEntryRevisionChanges: () => [] };
  }
  if (request === "@/app/portal/notes/view/noteHistoryRevision") {
    return { formatRevisionUpdate: () => null };
  }
  if (request === "./insightContext") {
    return { buildInsightContext: async () => null };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { parseQuestion } = require("../insightsEngine.ts");
Module._load = originalLoad;

test("today selects the current clinical calendar date", () => {
  const now = new Date(2026, 6, 28, 21, 15);
  const parsed = parseQuestion("What notes were submitted today?", now);

  assert.equal(parsed.intent, "compliance");
  assert.deepEqual(
    [
      parsed.dateRange.from.getFullYear(),
      parsed.dateRange.from.getMonth(),
      parsed.dateRange.from.getDate(),
      parsed.dateRange.from.getHours(),
    ],
    [2026, 6, 28, 0]
  );
  assert.deepEqual(
    [
      parsed.dateRange.to.getFullYear(),
      parsed.dateRange.to.getMonth(),
      parsed.dateRange.to.getDate(),
      parsed.dateRange.to.getHours(),
    ],
    [2026, 6, 29, 0]
  );
});

test("the word notes alone does not turn a clinical summary into timing compliance", () => {
  const now = new Date(2026, 6, 28, 21, 15);
  const parsed = parseQuestion("Summarize today's provider notes.", now);

  assert.equal(parsed.intent, "summary");
  assert.ok(parsed.dateRange);
});

test("yesterday selects the previous clinical calendar date", () => {
  const now = new Date(2026, 6, 28, 21, 15);
  const parsed = parseQuestion("What happened yesterday?", now);

  assert.deepEqual(
    [
      parsed.dateRange.from.getFullYear(),
      parsed.dateRange.from.getMonth(),
      parsed.dateRange.from.getDate(),
    ],
    [2026, 6, 27]
  );
  assert.deepEqual(
    [
      parsed.dateRange.to.getFullYear(),
      parsed.dateRange.to.getMonth(),
      parsed.dateRange.to.getDate(),
    ],
    [2026, 6, 28]
  );
});
