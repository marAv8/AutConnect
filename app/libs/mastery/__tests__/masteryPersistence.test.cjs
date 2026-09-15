/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => {
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  activateCorrectedGoal,
  masteryPersistenceAction,
} = require("../masteryPersistenceState.ts");

const persistenceSource = fs.readFileSync(
  path.join(__dirname, "../masteryPersistence.ts"),
  "utf8"
);
const createEntrySource = fs.readFileSync(
  path.join(__dirname, "../../../actions/createEntry.ts"),
  "utf8"
);
const updateOwnEntrySource = fs.readFileSync(
  path.join(__dirname, "../../../actions/updateOwnEntry.ts"),
  "utf8"
);
const completeSessionNoteSource = fs.readFileSync(
  path.join(__dirname, "../../../actions/completeSessionNote.ts"),
  "utf8"
);

test("completed entry persistence uses the shared POLICY_V1 reconciler", () => {
  assert.match(createEntrySource, /reconcileMasteryForCompletedGoals/);
  assert.match(createEntrySource, /!shouldStoreContextData && isCompletedUpdate/);
  assert.doesNotMatch(createEntrySource, /updateMasteredGoals|normalizeItem/);
});

test("persistence loads only completed records and stores policy provenance", () => {
  assert.match(persistenceSource, /status: EntryStatus\.COMPLETED/);
  assert.match(persistenceSource, /GoalMasteryBasis\.POLICY_V1/);
  assert.match(persistenceSource, /masteryEvidenceEntryIds/);
  assert.match(persistenceSource, /masteredAt/);
  assert.match(persistenceSource, /isActive: false/);
  assert.match(persistenceSource, /isMastered: true/);
});

test("legacy goals cannot be relabeled by POLICY_V1", () => {
  assert.match(persistenceSource, /isMastered: false/);
  assert.match(persistenceSource, /masteryBasis: null/);
  assert.equal(
    masteryPersistenceAction({
      isMastered: true,
      masteryBasis: "LEGACY_NORMALIZED",
      candidateStatus: "candidate",
    }),
    "none"
  );
});

test("POLICY_V1 mastery is cleared when corrected evidence no longer qualifies", () => {
  for (const candidateStatus of ["notCandidate", "unknown"]) {
    assert.equal(
      masteryPersistenceAction({
        isMastered: true,
        masteryBasis: "POLICY_V1",
        candidateStatus,
      }),
      "clear"
    );
  }
  assert.match(persistenceSource, /isActive: true/);
  assert.match(persistenceSource, /masteredAt: null/);
  assert.match(persistenceSource, /masteryEvidenceEntryIds: Prisma\.DbNull/);
  assert.match(persistenceSource, /masteryRevokedAt: new Date\(\)/);
  assert.match(persistenceSource, /masteryRevokedEvidenceEntryIds/);
});

test("qualifying corrected evidence marks or refreshes POLICY_V1 mastery", () => {
  for (const state of [
    { isMastered: false, masteryBasis: null },
    { isMastered: true, masteryBasis: "POLICY_V1" },
  ]) {
    assert.equal(
      masteryPersistenceAction({
        ...state,
        candidateStatus: "candidate",
      }),
      "mark"
    );
  }
});

test("a corrected historical goal does not duplicate an active replacement", () => {
  assert.equal(activateCorrectedGoal(false), true);
  assert.equal(activateCorrectedGoal(true), false);
  assert.match(persistenceSource, /id: \{ not: goal\.id \}/);
  assert.match(persistenceSource, /isActive: activateCorrectedGoal/);
});

test("all completed-note mutation paths invoke backend reconciliation", () => {
  assert.match(updateOwnEntrySource, /reconcileMasteryForCompletedGoals/);
  assert.match(updateOwnEntrySource, /existingEntry\.items/);
  assert.match(completeSessionNoteSource, /reconcileMasteryForCompletedGoals/);
  assert.match(completeSessionNoteSource, /entries\.flatMap/);
});

test("persistence does not depend on normalized session scoring or signals", () => {
  assert.doesNotMatch(
    persistenceSource,
    /normalizeItem|normalizedScore|clientSignal|buildInsightSnapshot|synthesi/i
  );
});
