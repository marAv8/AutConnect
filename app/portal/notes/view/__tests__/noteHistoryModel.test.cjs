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

const { groupCaretakerEntriesByDay } = require("../noteHistoryModel.ts");

function caretakerEntry(overrides) {
  return {
    id: overrides.id,
    kind: overrides.kind,
    status: "COMPLETED",
    note: overrides.note,
    clinicalReflection: null,
    date: overrides.date,
    completedAt: overrides.completedAt,
    finalScore: null,
    providerName: "Mona Av",
    providerRole: "Caretaker",
    items: [],
    abcObservations: [],
  };
}

test("groups same-day caretaker morning and evening context into one history note", () => {
  const evening = caretakerEntry({
    id: "evening-entry",
    kind: "EveningContext",
    note: "Dinner / Appetite: Ate well",
    date: "2026-07-20T19:00:00.000Z",
    completedAt: "2026-07-20T19:15:00.000Z",
  });
  const morning = caretakerEntry({
    id: "morning-entry",
    kind: "MorningContext",
    note: "Sleep: Good",
    date: "2026-07-20T08:00:00.000Z",
    completedAt: "2026-07-20T08:10:00.000Z",
  });

  const grouped = groupCaretakerEntriesByDay([evening, morning]);

  assert.equal(grouped.length, 1);
  assert.equal(grouped[0].completedAt, evening.completedAt);
  assert.deepEqual(
    grouped[0].caretakerContextSections.map((section) => [section.entryId, section.kind]),
    [
      ["morning-entry", "MorningContext"],
      ["evening-entry", "EveningContext"],
    ]
  );
});

test("keeps caretaker context from different dates as separate history notes", () => {
  const today = caretakerEntry({
    id: "today-morning",
    kind: "MorningContext",
    note: "Sleep: Good",
    date: "2026-07-20T08:00:00.000Z",
    completedAt: "2026-07-20T08:10:00.000Z",
  });
  const yesterday = caretakerEntry({
    id: "yesterday-evening",
    kind: "EveningContext",
    note: "Dinner / Appetite: Ate some",
    date: "2026-07-19T19:00:00.000Z",
    completedAt: "2026-07-19T19:15:00.000Z",
  });

  const grouped = groupCaretakerEntriesByDay([today, yesterday]);

  assert.equal(grouped.length, 2);
});
