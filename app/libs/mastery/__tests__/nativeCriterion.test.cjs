/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
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
  calculateCriterionStreak,
  evaluateNativeCriterion,
} = require("../nativeCriterion.ts");

function criterion(overrides = {}) {
  return {
    metricType: "Percentage",
    rawValue: 86,
    score: null,
    targetValue: 85,
    comparison: "GreaterThan",
    configuredMetricType: "Percentage",
    metadataConsistent: true,
    ...overrides,
  };
}

function session(entryId, value, index, overrides = {}) {
  return {
    ...criterion({ rawValue: value }),
    entryId,
    occurredAt: `2026-08-${String(index + 1).padStart(2, "0")}T17:00:00.000Z`,
    completedAt: `2026-08-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`,
    status: "COMPLETED",
    providerId: "provider-a",
    goalKey: "goal:one",
    configurationKey: "Percentage|GreaterThan:85",
    ...overrides,
  };
}

test("Percentage thresholds use the configured native target and strict boundaries", () => {
  for (const targetValue of [80, 85, 90]) {
    assert.equal(
      evaluateNativeCriterion(criterion({ rawValue: targetValue, targetValue })),
      "notMet"
    );
    assert.equal(
      evaluateNativeCriterion(
        criterion({ rawValue: targetValue + 0.01, targetValue })
      ),
      "met"
    );
  }
});

test("LessThan, GreaterThan, and Equal are strict stored-enum comparisons", () => {
  assert.equal(evaluateNativeCriterion(criterion({ rawValue: 4, targetValue: 5, comparison: "LessThan" })), "met");
  assert.equal(evaluateNativeCriterion(criterion({ rawValue: 5, targetValue: 5, comparison: "LessThan" })), "notMet");
  assert.equal(evaluateNativeCriterion(criterion({ rawValue: 6, targetValue: 5, comparison: "GreaterThan" })), "met");
  assert.equal(evaluateNativeCriterion(criterion({ rawValue: 5, targetValue: 5, comparison: "GreaterThan" })), "notMet");
  assert.equal(evaluateNativeCriterion(criterion({ rawValue: 5, targetValue: 5, comparison: "Equal" })), "met");
  assert.equal(evaluateNativeCriterion(criterion({ rawValue: 5.01, targetValue: 5, comparison: "Equal" })), "notMet");
});

test("Duration and Frequency support both higher and lower native criteria", () => {
  for (const metricType of ["Duration", "Frequency"]) {
    assert.equal(evaluateNativeCriterion(criterion({ metricType, configuredMetricType: metricType, rawValue: 11, targetValue: 10, comparison: "GreaterThan" })), "met");
    assert.equal(evaluateNativeCriterion(criterion({ metricType, configuredMetricType: metricType, rawValue: 9, targetValue: 10, comparison: "LessThan" })), "met");
  }
});

test("Subjective ratings use score for all configured rating profiles", () => {
  for (const target of ["Tacting", "Prompting", "Assistance", "Independence", "Participation", "Accuracy"]) {
    assert.equal(
      evaluateNativeCriterion(
        criterion({ metricType: "Subjective", configuredMetricType: "Subjective", rawValue: 99, score: 4, targetValue: 3, comparison: "GreaterThan", target })
      ),
      "met"
    );
  }
});

test("missing, invalid, inconsistent, and incompatible metadata are unknown", () => {
  const cases = [
    { targetValue: null },
    { targetValue: Number.NaN },
    { comparison: null },
    { comparison: "AtLeast" },
    { metadataConsistent: false },
    { configuredMetricType: "Duration" },
    { rawValue: null },
    { rawValue: 101 },
    { targetValue: -1 },
  ];
  for (const overrides of cases) {
    assert.equal(evaluateNativeCriterion(criterion(overrides)), "unknown");
  }
});

test("streaks count unique completed Entry IDs and preserve exact source IDs", () => {
  const result = calculateCriterionStreak([
    session("entry-1", 86, 0),
    session("entry-2", 87, 1),
    session("entry-2", 99, 1, { itemId: "duplicate-item" }),
    session("entry-3", 88, 2),
    session("draft-entry", 99, 3, { status: "IN_PROGRESS", completedAt: null }),
  ]);
  assert.deepEqual(result, {
    consecutiveCriterionSessions: 3,
    criterionSourceRecordIds: ["entry-1", "entry-2", "entry-3"],
  });
});

test("a not-met or unknown completed session resets the trailing streak", () => {
  assert.deepEqual(
    calculateCriterionStreak([
      session("entry-1", 90, 0),
      session("entry-2", 85, 1),
      session("entry-3", 90, 2),
    ]),
    { consecutiveCriterionSessions: 1, criterionSourceRecordIds: ["entry-3"] }
  );
  assert.deepEqual(
    calculateCriterionStreak([
      session("entry-1", 90, 0),
      session("entry-2", null, 1),
    ]),
    { consecutiveCriterionSessions: 0, criterionSourceRecordIds: [] }
  );
});

test("a streak never crosses provider, goal, or configuration boundaries", () => {
  for (const incompatible of [
    { providerId: "provider-b" },
    { goalKey: "goal:two" },
    { configurationKey: "Percentage|GreaterThan:90", targetValue: 90, rawValue: 91 },
  ]) {
    const result = calculateCriterionStreak([
      session("entry-1", 90, 0),
      session("entry-2", 90, 1, incompatible),
    ]);
    assert.equal(result.consecutiveCriterionSessions, 1);
    assert.deepEqual(result.criterionSourceRecordIds, ["entry-2"]);
  }
});
