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
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const {
  evaluateClientSignalGateway,
  latestCompletedSessionDate,
} = require("../clientSignalGateway.ts");

function item(overrides = {}) {
  return {
    goalId: overrides.goalId ?? "goal-1",
    target: overrides.target ?? "Transitions",
    goal: overrides.goal ?? "Move between scheduled activities",
    score: Object.prototype.hasOwnProperty.call(overrides, "score")
      ? overrides.score
      : 2,
    rawValue: overrides.rawValue ?? null,
    metricType: overrides.metricType ?? "Subjective",
    measurementProfile: overrides.measurementProfile ?? "PromptLevel",
    comparison: overrides.comparison ?? null,
    observation: overrides.observation ?? null,
  };
}

function entry(overrides = {}) {
  return {
    id: overrides.id,
    providerId: overrides.providerId ?? "provider-bt",
    providerRole: overrides.providerRole ?? "BehaviorTherapist",
    date: overrides.date,
    note: overrides.note ?? null,
    items: overrides.items ?? [item()],
    abcObservations: overrides.abcObservations ?? [],
  };
}

function evaluate(entries, overrides = {}) {
  return evaluateClientSignalGateway({
    entries,
    targetSessionDate: overrides.targetSessionDate ?? "2026-08-03",
    teamFocus: overrides.teamFocus ?? null,
    semanticEvidence: overrides.semanticEvidence ?? [],
  });
}

test("routine high assistance from one provider stays neutral", () => {
  const result = evaluate([
    entry({
      id: "routine",
      date: "2026-08-03T16:00:00",
      note: "Client completed a newly introduced target with maximum prompting.",
      items: [item({ score: 1 })],
    }),
  ]);
  assert.equal(result.color, "neutral");
});

test("cross-provider maximum support plus concern is amber", () => {
  const result = evaluate([
    entry({
      id: "bt-concern",
      date: "2026-07-29T15:00:00",
      note: "Client struggled and required full support during the transition.",
      items: [item({ score: 1 })],
    }),
    entry({
      id: "educator-concern",
      providerId: "provider-educator",
      providerRole: "Educator",
      date: "2026-08-03T12:00:00",
      note: "Client had difficulty and required maximum assistance in class.",
      items: [item({ score: 1 })],
    }),
  ]);
  assert.equal(result.color, "amber");
  assert.equal(result.reason, "cross_provider_support_difficulty");
});

test("an unusually positive session with reproducible context is blue", () => {
  const result = evaluate([
    entry({ id: "prior-1", date: "2026-07-20T12:00:00", items: [item({ score: 1 })] }),
    entry({ id: "prior-2", date: "2026-07-27T12:00:00", items: [item({ score: 1 })] }),
    entry({
      id: "outlier",
      date: "2026-08-03T12:00:00",
      note: "A visual schedule and preferred puzzle helped the client engage independently.",
      items: [item({ score: 4 })],
    }),
  ]);
  assert.equal(result.color, "blue");
  assert.equal(result.reason, "unusually_positive_session");
});

test("an increasing higher-is-better strength can become a positive outlier", () => {
  const strength = (rawValue) => item({
    goalId: "goal-self-advocacy",
    target: "Self-Advocacy",
    goal: "Communicates a need or boundary when it arises.",
    score: null,
    rawValue,
    metricType: "Frequency",
    measurementProfile: "Frequency",
    comparison: "GreaterThan",
  });
  const result = evaluate([
    entry({ id: "strength-1", date: "2026-07-20T12:00:00", items: [strength(1)] }),
    entry({ id: "strength-2", date: "2026-07-27T12:00:00", items: [strength(1)] }),
    entry({
      id: "strength-outlier",
      date: "2026-08-03T12:00:00",
      note: "The client independently communicated a need during the activity.",
      items: [strength(3)],
    }),
  ]);
  assert.equal(result.color, "blue");
  assert.equal(result.reason, "unusually_positive_session");
});

test("three successful recorded sessions establish mastery despite calendar gaps", () => {
  const result = evaluate([
    entry({ id: "mastery-1", date: "2026-07-09T12:00:00", items: [item({ score: 3 })] }),
    entry({ id: "mastery-2", date: "2026-07-23T12:00:00", items: [item({ score: 4 })] }),
    entry({ id: "mastery-3", date: "2026-08-03T12:00:00", items: [item({ score: 3 })] }),
  ]);
  assert.equal(result.color, "blue");
  assert.equal(result.reason, "three_session_mastery_pattern");
});

test("generic positive language without a measurable outlier stays neutral", () => {
  const result = evaluate([
    entry({
      id: "great-day",
      date: "2026-08-03T12:00:00",
      note: "Client had a great day.",
      items: [item({ score: 3 })],
    }),
  ]);
  assert.equal(result.color, "neutral");
});

test("a serious single-provider session is amber, not red", () => {
  const result = evaluate([
    entry({
      id: "single-serious",
      date: "2026-08-03T12:00:00",
      note: "Client hit staff and screamed during a prolonged transition.",
    }),
  ]);
  assert.equal(result.color, "amber");
  assert.equal(result.reason, "unusual_difficult_session");
});

test("corroborated destructive or aggressive behavior across providers is red", () => {
  const result = evaluate([
    entry({
      id: "serious-bt",
      date: "2026-07-31T12:00:00",
      note: "Client engaged in property destruction and hitting.",
    }),
    entry({
      id: "serious-educator",
      providerId: "provider-educator",
      providerRole: "Educator",
      date: "2026-08-03T12:00:00",
      note: "Client hit staff during the classroom transition.",
    }),
  ]);
  assert.equal(result.color, "red");
  assert.equal(result.reason, "corroborated_serious_behavior_pattern");
});

test("an active Case Support request does not affect a routine client signal", () => {
  const result = evaluateClientSignalGateway({
    entries: [entry({ id: "routine-with-case", date: "2026-08-03T12:00:00" })],
    targetSessionDate: "2026-08-03",
    caseRequests: [{
      id: "request-1",
      status: "CASE_OPENED",
      createdAt: "2026-08-03T08:00:00",
      updatedAt: "2026-08-03T08:00:00",
      concern: "Classroom integration needs review.",
      requestedSupport: "Coordinate a classroom schedule.",
      linkedCaseStatus: "OPEN",
    }],
  });
  assert.equal(result.color, "neutral");
  assert.equal(result.reason, "routine_session_baseline");
});

test("an active Case Support request cannot override a blue client signal", () => {
  const result = evaluateClientSignalGateway({
    entries: [
      entry({ id: "prior-1", date: "2026-07-20T12:00:00", items: [item({ score: 1 })] }),
      entry({ id: "prior-2", date: "2026-07-27T12:00:00", items: [item({ score: 1 })] }),
      entry({
        id: "positive-with-case",
        date: "2026-08-03T12:00:00",
        note: "A visual schedule helped the client participate independently.",
        items: [item({ score: 4 })],
      }),
    ],
    targetSessionDate: "2026-08-03",
    caseRequests: [{
      id: "request-1",
      status: "CASE_OPENED",
      createdAt: "2026-08-03T08:00:00",
      updatedAt: "2026-08-03T08:00:00",
      concern: "Classroom integration needs review.",
      requestedSupport: "Coordinate a classroom schedule.",
      linkedCaseStatus: "OPEN",
    }],
  });
  assert.equal(result.color, "blue");
  assert.equal(result.reason, "unusually_positive_session");
});

test("new independent functional communication is blue", () => {
  const communication = (score) => item({
    goalId: "goal-fct",
    target: "Functional Communication",
    goal: "Point to request a preferred item",
    score,
  });
  const result = evaluate([
    entry({ id: "fct-1", date: "2026-07-10T12:00:00", items: [communication(1)] }),
    entry({ id: "fct-2", date: "2026-07-24T12:00:00", items: [communication(2)] }),
    entry({ id: "fct-3", date: "2026-08-03T12:00:00", items: [communication(4)] }),
  ]);
  assert.equal(result.color, "blue");
  assert.equal(result.reason, "new_independent_functional_communication");
});

test("latest completed session uses the latest recorded date, not yesterday", () => {
  const result = latestCompletedSessionDate(
    [
      { date: "2026-07-20T12:00:00" },
      { date: "2026-07-29T12:00:00" },
    ],
    new Date("2026-08-04T09:00:00")
  );
  assert.equal(result, "2026-07-29");
});
