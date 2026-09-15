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
  evaluateMasteryCandidate,
} = require("../masteryCandidatePolicy.ts");

function session(entryId, rawValue, index, overrides = {}) {
  return {
    entryId,
    occurredAt: overrides.occurredAt ??
      `2026-08-${String(index + 1).padStart(2, "0")}T17:00:00.000Z`,
    completedAt: Object.hasOwn(overrides, "completedAt")
      ? overrides.completedAt
      : `2026-08-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`,
    status: overrides.status ?? "COMPLETED",
    providerId: overrides.providerId ?? "provider-a",
    goalId: overrides.goalId ?? "goal-a",
    metricType: overrides.metricType ?? "Percentage",
    rawValue,
    score: Object.hasOwn(overrides, "score") ? overrides.score : null,
    normalizedScore: Object.hasOwn(overrides, "normalizedScore")
      ? overrides.normalizedScore
      : null,
    ...(overrides.configuration
      ? { configuration: overrides.configuration }
      : {}),
  };
}

function input(overrides = {}) {
  return {
    providerId: overrides.providerId ?? "provider-a",
    goalId: overrides.goalId ?? "goal-a",
    metricType: overrides.metricType ?? "Percentage",
    percentageMasteryThreshold: overrides.percentageMasteryThreshold,
    targetValue: Object.hasOwn(overrides, "targetValue")
      ? overrides.targetValue
      : 80,
    comparison: Object.hasOwn(overrides, "comparison")
      ? overrides.comparison
      : "GreaterThan",
    requiredConsecutiveSessions: overrides.requiredConsecutiveSessions,
    metadataConsistent: overrides.metadataConsistent ?? true,
    sessions: overrides.sessions ?? [],
  };
}

test("Percentage mastery policy is explicitly inclusive at 85", () => {
  const cases = [
    { value: 84.99, status: "notCandidate", reason: "latestSessionDidNotQualify" },
    { value: 85, status: "notCandidate", reason: "insufficientSessions" },
    { value: 91, status: "notCandidate", reason: "insufficientSessions" },
  ];
  for (const item of cases) {
    const result = evaluateMasteryCandidate(
      input({ sessions: [session("entry-1", item.value, 0)] })
    );
    assert.equal(result.status, item.status);
    assert.equal(result.reason, item.reason);
    assert.equal(result.threshold, 85);
    assert.equal(result.comparison, "AtLeast");
  }
});

test("three distinct completed Percentage entries at exactly 85 are a candidate", () => {
  const result = evaluateMasteryCandidate(
    input({
      sessions: [0, 1, 2].map((index) =>
        session(`entry-${index + 1}`, 85, index)
      ),
    })
  );
  assert.deepEqual(result, {
    status: "candidate",
    ruleStatus: "configured",
    metricType: "Percentage",
    threshold: 85,
    comparison: "AtLeast",
    requiredConsecutiveSessions: 3,
    consecutiveQualifyingSessions: 3,
    evidenceEntryIds: ["entry-1", "entry-2", "entry-3"],
    reason: "percentageAtLeast85",
  });
});

test("configured consecutive-session requirement is honored and validated", () => {
  const sessions = [85, 86, 87, 88].map((value, index) =>
    session(`entry-${index + 1}`, value, index)
  );
  const fourRequired = evaluateMasteryCandidate(
    input({ requiredConsecutiveSessions: 4, sessions })
  );
  assert.equal(fourRequired.status, "candidate");
  assert.equal(fourRequired.requiredConsecutiveSessions, 4);

  for (const requiredConsecutiveSessions of [0, 21, 2.5]) {
    const invalid = evaluateMasteryCandidate(
      input({ requiredConsecutiveSessions, sessions })
    );
    assert.equal(invalid.status, "unknown");
    assert.equal(invalid.ruleStatus, "inconsistent");
    assert.equal(invalid.reason, "inconsistentConfiguration");
  }
});

test("a higher configured Percentage mastery threshold replaces 85", () => {
  const result = evaluateMasteryCandidate(
    input({
      percentageMasteryThreshold: 90,
      sessions: [90, 91, 92].map((value, index) =>
        session(`entry-${index + 1}`, value, index)
      ),
    })
  );
  assert.equal(result.status, "candidate");
  assert.equal(result.threshold, 90);
});

test("a Percentage session target of 80 does not lower mastery below 85", () => {
  const result = evaluateMasteryCandidate(
    input({
      targetValue: 80,
      comparison: "GreaterThan",
      sessions: [82, 83, 84].map((value, index) =>
        session(`entry-${index + 1}`, value, index)
      ),
    })
  );
  assert.equal(result.threshold, 85);
  assert.equal(result.status, "notCandidate");
  assert.equal(result.reason, "latestSessionDidNotQualify");
});

test("Percentage never substitutes score or normalized score for missing rawValue", () => {
  const result = evaluateMasteryCandidate(
    input({
      sessions: [
        session("entry-1", null, 0, { score: 10, normalizedScore: 1 }),
      ],
    })
  );
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "unknownSessionMeasurement");
  assert.deepEqual(result.evidenceEntryIds, []);
});

test("Duration and Frequency use strict configured native criteria", () => {
  const definitions = [
    { metricType: "Duration", targetValue: 10, comparison: "LessThan", values: [9, 8, 7] },
    { metricType: "Duration", targetValue: 10, comparison: "GreaterThan", values: [11, 12, 13] },
    { metricType: "Frequency", targetValue: 5, comparison: "GreaterThan", values: [6, 7, 8] },
    { metricType: "Frequency", targetValue: 5, comparison: "LessThan", values: [4, 3, 2] },
    { metricType: "Frequency", targetValue: 5, comparison: "Equal", values: [5, 5, 5] },
  ];
  for (const definition of definitions) {
    const result = evaluateMasteryCandidate(
      input({
        ...definition,
        sessions: definition.values.map((value, index) =>
          session(`entry-${index + 1}`, value, index, {
            metricType: definition.metricType,
          })
        ),
      })
    );
    assert.equal(result.status, "candidate", JSON.stringify(definition));
    assert.equal(result.reason, "configuredNativeCriterion");
    assert.equal(result.threshold, definition.targetValue);
    assert.equal(result.comparison, definition.comparison);
  }
});

test("Duration and Frequency missing or inconsistent configuration is unknown", () => {
  const missing = evaluateMasteryCandidate(
    input({ metricType: "Duration", targetValue: null, comparison: null })
  );
  assert.equal(missing.status, "unknown");
  assert.equal(missing.ruleStatus, "missing");
  assert.equal(missing.reason, "missingConfiguration");

  const inconsistent = evaluateMasteryCandidate(
    input({ metricType: "Frequency", metadataConsistent: false })
  );
  assert.equal(inconsistent.status, "unknown");
  assert.equal(inconsistent.ruleStatus, "inconsistent");
  assert.equal(inconsistent.reason, "inconsistentConfiguration");

  const invalid = evaluateMasteryCandidate(
    input({ metricType: "Duration", targetValue: Number.NaN })
  );
  assert.equal(invalid.status, "unknown");
  assert.equal(invalid.ruleStatus, "inconsistent");
  assert.equal(invalid.reason, "inconsistentConfiguration");
});

test("Subjective mastery candidacy remains unknown regardless of available values", () => {
  for (const target of [
    "PromptLevel",
    "CueingLevel",
    "AssistanceLevel",
    "SupportLevel",
    "Independence",
    "Tacting",
    "Manding",
    "Participation",
  ]) {
    const result = evaluateMasteryCandidate(
      input({
        metricType: "Subjective",
        sessions: [1, 4, 10].map((score, index) =>
          session(`${target}-${index}`, 100, index, {
            metricType: "Subjective",
            score,
            normalizedScore: 1,
          })
        ),
      })
    );
    assert.equal(result.status, "unknown", target);
    assert.equal(result.ruleStatus, "missing", target);
    assert.equal(result.reason, "unsupportedSubjectiveScale", target);
  }
});

test("duplicate items count once and drafts or incomplete entries are ignored", () => {
  const result = evaluateMasteryCandidate(
    input({
      sessions: [
        session("entry-1", 85, 0),
        session("entry-2", 86, 1),
        session("entry-2", 86, 1),
        session("entry-3", 87, 2),
        session("draft", 100, 3, { status: "IN_PROGRESS", completedAt: null }),
        session("incomplete", 100, 4, { status: "DRAFT", completedAt: null }),
      ],
    })
  );
  assert.equal(result.status, "candidate");
  assert.equal(result.consecutiveQualifyingSessions, 3);
  assert.deepEqual(result.evidenceEntryIds, ["entry-1", "entry-2", "entry-3"]);
});

test("a failing latest session resets the trailing streak", () => {
  const result = evaluateMasteryCandidate(
    input({
      sessions: [85, 86, 87, 84.99].map((value, index) =>
        session(`entry-${index + 1}`, value, index)
      ),
    })
  );
  assert.equal(result.status, "notCandidate");
  assert.equal(result.reason, "latestSessionDidNotQualify");
  assert.equal(result.consecutiveQualifyingSessions, 0);
  assert.deepEqual(result.evidenceEntryIds, []);
});

test("an unknown latest session resets the result to unknown", () => {
  const result = evaluateMasteryCandidate(
    input({
      sessions: [85, 86, 87, null].map((value, index) =>
        session(`entry-${index + 1}`, value, index)
      ),
    })
  );
  assert.equal(result.status, "unknown");
  assert.equal(result.reason, "unknownSessionMeasurement");
  assert.equal(result.consecutiveQualifyingSessions, 0);
});

test("provider, goal, metric, and mastery configuration boundaries stop a streak", () => {
  const incompatibleRecords = [
    session("entry-1", 85, 0, { providerId: "provider-b" }),
    session("entry-1", 85, 0, { goalId: "goal-b" }),
    session("entry-1", 85, 0, { metricType: "Frequency" }),
    session("entry-1", 90, 0, {
      configuration: {
        percentageMasteryThreshold: 90,
        targetValue: 80,
        comparison: "GreaterThan",
      },
    }),
  ];
  for (const incompatible of incompatibleRecords) {
    const result = evaluateMasteryCandidate(
      input({
        sessions: [
          incompatible,
          session("entry-2", 86, 1),
          session("entry-3", 87, 2),
        ],
      })
    );
    assert.equal(result.status, "notCandidate");
    assert.equal(result.consecutiveQualifyingSessions, 2);
    assert.deepEqual(result.evidenceEntryIds, ["entry-2", "entry-3"]);
  }
});

test("an incompatible latest record produces an unknown inconsistent result", () => {
  const result = evaluateMasteryCandidate(
    input({
      sessions: [
        session("entry-1", 85, 0),
        session("entry-2", 86, 1),
        session("entry-3", 87, 2, { goalId: "different-goal" }),
      ],
    })
  );
  assert.equal(result.status, "unknown");
  assert.equal(result.ruleStatus, "inconsistent");
  assert.equal(result.reason, "inconsistentConfiguration");
  assert.deepEqual(result.evidenceEntryIds, []);
});

test("reintroduced goals with the same conceptual text but new IDs remain separate", () => {
  const result = evaluateMasteryCandidate(
    input({
      goalId: "goal-reintroduced",
      sessions: [
        session("old-entry", 95, 0, { goalId: "goal-original" }),
        session("new-entry-1", 85, 1, { goalId: "goal-reintroduced" }),
        session("new-entry-2", 86, 2, { goalId: "goal-reintroduced" }),
      ],
    })
  );
  assert.equal(result.status, "notCandidate");
  assert.equal(result.consecutiveQualifyingSessions, 2);
  assert.deepEqual(result.evidenceEntryIds, ["new-entry-1", "new-entry-2"]);
});

test("calendar gaps do not break a qualifying streak and all evidence IDs are preserved", () => {
  const dates = ["2026-01-01", "2026-03-15", "2026-08-19", "2026-12-31"];
  const result = evaluateMasteryCandidate(
    input({
      sessions: dates.map((date, index) =>
        session(`entry-${index + 1}`, 85 + index, index, {
          occurredAt: `${date}T17:00:00.000Z`,
          completedAt: `${date}T18:00:00.000Z`,
        })
      ),
    })
  );
  assert.equal(result.status, "candidate");
  assert.equal(result.consecutiveQualifyingSessions, 4);
  assert.deepEqual(result.evidenceEntryIds, ["entry-1", "entry-2", "entry-3", "entry-4"]);
});

test("normalized scores have no effect on the mastery-candidate result", () => {
  const sessions = [85, 86, 87].map((value, index) =>
    session(`entry-${index + 1}`, value, index, { normalizedScore: 0 })
  );
  const before = evaluateMasteryCandidate(input({ sessions }));
  const after = evaluateMasteryCandidate(
    input({
      sessions: sessions.map((record) => ({ ...record, normalizedScore: 999 })),
    })
  );
  assert.deepEqual(after, before);
});

test("the pure policy has no persistence, signal, Insights-output, or normalization dependency", () => {
  const source = fs.readFileSync(
    require.resolve("../masteryCandidatePolicy.ts"),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /normalizeItem|Prisma|\bdb\.|isMastered|isActive|clientSignal|buildInsightSnapshot|synthesi/i
  );
});
