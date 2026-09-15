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
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const originalLoad = Module._load;
Module._load = function load(request, parent, isMain) {
  if (request === "./insightSnapshot") {
    return {
      buildInsightSnapshot: () => ({
        lenses: {
          patterns: {
            findings: [
              {
                title: "Recorded pattern for Transitions",
                statement: "Recorded Transitions ratings increased.",
                evidenceStrength: "medium",
                limitations: [],
                measurement: {
                  direction: "increasing",
                  goalRelationship: "unknown",
                },
                sources: [
                  {
                    label: "Transitions rating",
                    excerpt: "Transitions: recorded rating 3.",
                    occurredAt: "2026-08-05T17:00:00.000Z",
                    recordId: "transitions-5",
                  },
                ],
              },
              {
                title: "Recorded pattern for Manding",
                statement: "Recorded Manding ratings increased.",
                evidenceStrength: "medium",
                limitations: [],
                measurement: {
                  direction: "increasing",
                  goalRelationship: "unknown",
                },
                sources: [],
              },
              {
                title: "Recorded pattern for Tacting",
                statement: "Recorded Tacting ratings decreased.",
                evidenceStrength: "medium",
                limitations: [],
                measurement: {
                  direction: "decreasing",
                  goalRelationship: "unknown",
                },
                sources: [],
              },
            ],
          },
        },
      }),
    };
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { buildGuardedContextualInsight } = require("../guardedContextualInsight.ts");
Module._load = originalLoad;

function measurement(sessionId, day, value) {
  return {
    itemId: `${sessionId}-item`,
    sessionId,
    date: `2026-08-${String(day).padStart(2, "0")}T17:00:00.000Z`,
    status: "COMPLETED",
    completedAt: `2026-08-${String(day).padStart(2, "0")}T18:00:00.000Z`,
    measurementValue: value,
    valueBasis: "score",
    rawValue: null,
    score: value,
    normalizedScore: value,
    changeFromBaseline: null,
    changeFromPrevious: null,
    trendDirection: "flat",
    lowData: false,
    clinicallySmallButPositiveChange: false,
  };
}

function series(target, values) {
  return {
    providerId: "provider-1",
    providerName: "Taylor R.",
    providerRole: "BehaviorTherapist",
    goalKey: `goal:${target}`,
    goalId: `goal-${target}`,
    target,
    goal: `Record ${target} ratings`,
    domain: "Adaptive",
    metricType: "Subjective",
    targetValue: null,
    comparison: null,
    metadataConsistent: true,
    measurementProfile: null,
    goalIsActive: true,
    legacyIsMastered: false,
    masteryBasis: null,
    masteredAt: null,
    masteryEvidenceEntryIds: [],
    masteryRevokedAt: null,
    masteryRevokedEvidenceEntryIds: [],
    masteryThreshold: null,
    masteryRequiredSessions: 3,
    measurementValueBasis: "score",
    sessions: values.map((value, index) =>
      measurement(`${target.toLowerCase()}-${index + 1}`, index + 1, value)
    ),
    measurementTrend: "up",
    measurementFirstAverage: 1,
    measurementSecondAverage: 3,
    normalizedFirstAverage: 1,
    normalizedSecondAverage: 3,
  };
}

test("a when-did-it-increase question identifies exact comparable measurements and dates", () => {
  const transitions = series("Transitions", [1, 1, 2, 2, 3]);
  const manding = series("Manding", [1, 2, 3]);
  const context = {
    providerGoalSeries: [transitions, manding],
    sessions: transitions.sessions.map((point, index) => ({
      id: point.sessionId,
      note: index === 2 ? "Waited before moving to the next activity." : null,
    })),
  };

  const answer = buildGuardedContextualInsight(
    context,
    "patterns",
    "For transitions, when did the ratings increase?"
  );

  assert.equal(answer.headline, "Transitions rating increases");
  assert.match(answer.summary, /2nd and 3rd comparable measurements/);
  assert.match(answer.summary, /rating 1 on Aug 2, 2026 to rating 2 on Aug 3, 2026/);
  assert.match(answer.summary, /4th and 5th comparable measurements/);
  assert.match(answer.summary, /Waited before moving to the next activity\./);
  assert.doesNotMatch(answer.summary, /Manding/);
  assert.deepEqual(
    answer.evidence.map((item) => item.sourceId),
    ["transitions-2", "transitions-3", "transitions-4", "transitions-5"]
  );
});

test("a when-did-it-decrease question uses the requested direction", () => {
  const context = {
    providerGoalSeries: [series("Tacting", [3, 2, 2, 1])],
    sessions: [],
  };
  const answer = buildGuardedContextualInsight(
    context,
    "patterns",
    "When did Tacting ratings decrease?"
  );

  assert.match(answer.summary, /1st and 2nd comparable measurements/);
  assert.match(answer.summary, /3rd and 4th comparable measurements/);
  assert.doesNotMatch(answer.summary, /increased/);
});

test("a positive-trend question does not label unresolved rating direction as progress", () => {
  const context = {
    providerGoalSeries: [series("Transitions", [1, 2, 3])],
    documentationRecords: [
      { providerRole: "BehaviorTherapist" },
      { providerRole: "OccupationalTherapist" },
      { providerRole: "SpeechPathologist" },
    ],
  };
  const answer = buildGuardedContextualInsight(
    context,
    "patterns",
    "Are there any positive trends?"
  );

  assert.equal(answer.headline, "No confirmed positive trend");
  assert.match(answer.summary, /Transitions increased/);
  assert.match(answer.summary, /Manding increased/);
  assert.match(answer.summary, /Tacting decreased/);
  assert.match(answer.summary, /configured scales do not establish/i);
  assert.match(answer.summary, /Behavior Therapy/);
  assert.match(answer.summary, /Occupational Therapy/);
  assert.match(answer.summary, /Speech Therapy/);
  assert.doesNotMatch(answer.summary, /Tacting.*positive/i);
});
