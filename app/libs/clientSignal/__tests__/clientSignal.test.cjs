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

const { deriveClientSignal } = require("../deriveClientSignal.ts");
const now = new Date("2026-08-03T20:00:00.000Z");

function entry(overrides = {}) {
  return {
    id: overrides.id ?? "entry-1",
    providerId: overrides.providerId ?? "provider-bt",
    providerRole: overrides.providerRole ?? "BehaviorTherapist",
    date: overrides.date ?? "2026-08-03T16:00:00.000Z",
    note: overrides.note ?? null,
    items: overrides.items ?? [],
    abcObservations: overrides.abcObservations ?? [],
  };
}

function communicationItem(score) {
  return {
    goalId: "goal-functional-request",
    target: "Functional Communication",
    goal: "Independently request a preferred item with picture exchange",
    score,
    metricType: "PromptLevel",
  };
}

test("ordinary high-assistance work remains neutral", () => {
  const signal = deriveClientSignal({
    now,
    entries: [
      entry({
        items: [{
          target: "Bilateral Coordination",
          goal: "Climb ladder using step-to gait",
          score: 1,
          metricType: "PromptLevel",
          observation: "Required full physical assistance",
        }],
      }),
    ],
  });

  assert.equal(signal.color, "neutral");
  assert.equal(signal.requiresSupervisorReview, false);
});

test("new independent functional communication proposes blue", () => {
  const signal = deriveClientSignal({
    now,
    entries: [
      entry({ id: "prior-1", date: "2026-07-30T16:00:00.000Z", items: [communicationItem(2)] }),
      entry({ id: "prior-2", date: "2026-08-01T16:00:00.000Z", items: [communicationItem(3)] }),
      entry({ id: "independent", date: "2026-08-03T16:00:00.000Z", items: [communicationItem(4)] }),
    ],
  });

  assert.equal(signal.color, "blue");
  assert.equal(signal.reason, "new_independent_functional_communication");
});

test("repeated long transitions propose amber-gold", () => {
  const transitionItem = (minutes) => ({
    target: "Transitions",
    goal: "Transition into classroom",
    metricType: "Duration",
    rawValue: minutes,
  });
  const signal = deriveClientSignal({
    now,
    entries: [
      entry({ id: "transition-1", date: "2026-08-01T16:00:00.000Z", items: [transitionItem(20)] }),
      entry({ id: "transition-2", date: "2026-08-03T16:00:00.000Z", items: [transitionItem(24)] }),
    ],
  });

  assert.equal(signal.color, "amber");
  assert.equal(signal.reason, "transition_above_personal_baseline");
});

test("bounded safety language is amber rather than red", () => {
  const signal = deriveClientSignal({
    now,
    entries: [entry({
      abcObservations: [{
        antecedent: "Access to a preferred item ended",
        behavior: "Client attempted elopement toward the sensory area",
        consequence: "Provider redirected client safely",
      }],
    })],
  });

  assert.equal(signal.color, "amber");
  assert.equal(signal.reason, "bounded_safety_related_event");
});

test("a sustained serious pattern across days and providers proposes red", () => {
  const abcObservations = [{
    antecedent: "A routine demand was presented",
    behavior: "Repeated elopement from the assigned area",
    consequence: "The provider implemented the established support plan",
  }];
  const signal = deriveClientSignal({
    now,
    entries: [
      entry({
        id: "pattern-1",
        providerId: "provider-bt",
        date: "2026-07-29T16:00:00.000Z",
        abcObservations,
      }),
      entry({
        id: "pattern-2",
        providerId: "provider-educator",
        providerRole: "Educator",
        date: "2026-08-01T16:00:00.000Z",
        abcObservations,
      }),
      entry({
        id: "pattern-3",
        providerId: "provider-bt",
        date: "2026-08-03T16:00:00.000Z",
        abcObservations,
      }),
    ],
  });

  assert.equal(signal.color, "red");
  assert.equal(signal.reason, "sustained_serious_pattern");
  assert.equal(signal.confidence, "high");
});

test("an active Case Support request does not affect the derived client signal", () => {
  const signal = deriveClientSignal({
    now,
    entries: [],
    caseRequests: [{
      id: "request-1",
      status: "ACKNOWLEDGED",
      createdAt: "2026-08-02T16:00:00.000Z",
      updatedAt: "2026-08-03T16:00:00.000Z",
      concern: "Placement routine needs review",
      requestedSupport: "Coordinate a classroom plan",
    }],
  });

  assert.equal(signal.color, "neutral");
  assert.equal(signal.reason, "insufficient_recent_evidence");
});

test("the completed previous session is isolated from current-session activity", () => {
  const signal = deriveClientSignal({
    now,
    signalWindow: {
      start: new Date("2026-08-02T00:00:00.000Z"),
      end: new Date("2026-08-03T00:00:00.000Z"),
    },
    entries: [
      entry({
        id: "previous-session",
        date: "2026-08-02T16:00:00.000Z",
        items: [{
          target: "Classroom Routine",
          goal: "Participate in the established routine",
          score: 2,
          metricType: "PromptLevel",
        }],
      }),
      entry({
        id: "current-session",
        date: "2026-08-03T16:00:00.000Z",
        abcObservations: [{
          antecedent: "A change in routine occurred",
          behavior: "Client attempted elopement from the assigned area",
          consequence: "The established support plan was followed",
        }],
      }),
    ],
  });

  assert.equal(signal.color, "neutral");
});
