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
      target: ts.ScriptTarget.ES2020,
    },
    fileName: filename,
  });
  module._compile(output.outputText, filename);
};

const { normalizeClinicalEvents, normalizeEntry, normalizeTeamFocus } = require("../index.ts");

const date = "2026-07-16T08:00:00.000Z";
const clientId = "client-1";

function provider(id, role, firstName = role, lastName = "Provider") {
  return {
    id,
    firstName,
    lastName,
    role,
  };
}

const fixtures = {
  caretaker: {
    id: "entry-caregiver",
    clientId,
    date,
    kind: "MorningContext",
    providerId: "provider-caregiver",
    provider: provider("provider-caregiver", "Caregiver", "Care", "Giver"),
    note: "Sleep: Poor\nMedication: Not given",
    contextData: {
      kind: "MorningContext",
      entries: [
        { key: "sleep", label: "Sleep", value: "Poor" },
        { key: "medication", label: "Medication", value: "Not given" },
      ],
      comment: "Woke early and seemed tired.",
    },
  },
  educator: {
    id: "entry-educator",
    clientId,
    date,
    kind: "SessionNote",
    providerId: "provider-educator",
    provider: provider("provider-educator", "Educator", "Ed", "Teacher"),
    items: [
      {
        id: "item-educator",
        goalId: "goal-educator",
        target: "Assignment Completion",
        goal: "Complete independent work with support.",
        metricType: "Subjective",
        domain: "SkillAcquisition",
        score: 3,
        goalDefinition: { measurementProfile: "Completion" },
      },
    ],
  },
  behaviorTherapist: {
    id: "entry-bt",
    clientId,
    date,
    kind: "SessionNote",
    providerId: "provider-bt",
    provider: provider("provider-bt", "BehaviorTherapist", "Behavior", "Tech"),
    note:
      "After the supported transition, the client was happy and engaged and stated, “I am happy.”",
    items: [
      {
        id: "item-bt",
        goalId: "goal-bt",
        target: "Aggression Reduction",
        goal: "Reduce verbal aggression toward peers.",
        metricType: "Subjective",
        domain: "Behavior",
        score: 2,
        goalDefinition: { measurementProfile: "PromptLevel" },
      },
    ],
    abcObservations: [
      {
        id: "abc-1",
        antecedent: "Peer interaction",
        behavior: "Verbal aggression",
        consequence: "Redirected to task",
      },
    ],
  },
  speech: {
    id: "entry-speech",
    clientId,
    date,
    kind: "CommunicationObservation",
    providerId: "provider-speech",
    provider: provider("provider-speech", "SpeechPathologist", "Speech", "Path"),
    contextData: {
      kind: "CommunicationObservation",
      observations: [
        {
          category: "AAC",
          observation: "Used AAC to request preferred item.",
          recommendation: "Increase modeling",
        },
      ],
    },
  },
  occupationalTherapy: {
    id: "entry-ot",
    clientId,
    date,
    kind: "SensoryObservation",
    providerId: "provider-ot",
    provider: provider("provider-ot", "OccupationalTherapist", "Occ", "Therapy"),
    contextData: {
      kind: "SensoryObservation",
      observations: [
        {
          category: "Sensory Avoiding",
          observation: "Covered ears during loud classroom transition.",
          recommendation: "Increase sensory breaks",
        },
      ],
    },
  },
  supervisor: {
    id: "entry-supervisor",
    clientId,
    date,
    kind: "SupervisorObservation",
    providerId: "provider-supervisor",
    provider: provider("provider-supervisor", "Supervisor", "Clinical", "Lead"),
    note: "Observation Category: Team\nObservation: Continue transition focus.",
    contextData: {
      observationCategory: "Team",
      observation: "Continue transition focus.",
    },
  },
};

const teamFocus = {
  id: "team-focus-1",
  clientId,
  title: "Transition Independence",
  content: "Reduce transition behaviors across school and therapy settings.",
  updatedAt: date,
  authorId: "provider-supervisor",
  author: fixtures.supervisor.provider,
};

function assertValidEvent(event) {
  assert.equal(typeof event.id, "string");
  assert.equal(event.clientId, clientId);
  assert.equal(typeof event.occurredAt, "string");
  assert.equal(typeof event.source.providerId, "string");
  assert.equal(typeof event.source.providerName, "string");
  assert.equal(typeof event.source.providerRole, "string");
  assert.equal(typeof event.category, "string");
  assert.equal(typeof event.eventType, "string");
  assert.equal(typeof event.title, "string");
  assert.equal(typeof event.summary, "string");
  assert.ok(Array.isArray(event.tags));
  assert.ok(event.tags.length > 0);
}

test("caretaker documentation produces caregiver context clinical events", () => {
  const events = normalizeEntry(fixtures.caretaker);
  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((event) => event.eventType),
    ["caregiver_sleep_context", "caregiver_medication_context", "caregiver_comment"]
  );
  assert.equal(events[0].significance, "important");
  events.forEach(assertValidEvent);
});

test("educator documentation produces target progress clinical events", () => {
  const events = normalizeEntry(fixtures.educator);
  assert.equal(events.length, 1);
  assert.equal(events[0].category, "target_progress");
  assert.equal(events[0].eventType, "academic_target_progress");
  assert.equal(events[0].target.measurementProfile, "Completion");
  events.forEach(assertValidEvent);
});

test("behavior therapist documentation preserves a positive response from the provider note", () => {
  const events = normalizeEntry(fixtures.behaviorTherapist);
  assert.equal(events.length, 3);
  assert.deepEqual(
    events.map((event) => event.category),
    ["target_progress", "abc_observation", "provider_observation"]
  );
  assert.equal(events[1].details.behavior, "Verbal aggression");
  assert.equal(events[1].significance, "important");
  assert.equal(events[2].eventType, "positive_response_observed");
  assert.match(events[2].summary, /positive engagement and expressive language/);
  events.forEach(assertValidEvent);
});

test("behavior therapist target observation can produce the positive response signal", () => {
  const entry = {
    ...fixtures.behaviorTherapist,
    id: "entry-bt-target-observation",
    note: "",
    items: fixtures.behaviorTherapist.items.map((item) => ({
      ...item,
      observation:
        "After transition support, the client was calm and stated that she was happy.",
    })),
  };

  const events = normalizeEntry(entry);
  const positiveResponse = events.find(
    (event) => event.eventType === "positive_response_observed"
  );

  assert.ok(positiveResponse);
  assert.match(
    positiveResponse.summary,
    /positive engagement and expressive language/
  );
});

test("speech documentation preserves communication observation meaning", () => {
  const events = normalizeEntry(fixtures.speech);
  assert.equal(events.length, 1);
  assert.equal(events[0].category, "communication_observation");
  assert.equal(events[0].title, "AAC");
  events.forEach(assertValidEvent);
});

test("OT documentation preserves sensory observation meaning", () => {
  const events = normalizeEntry(fixtures.occupationalTherapy);
  assert.equal(events.length, 1);
  assert.equal(events[0].category, "sensory_observation");
  assert.equal(events[0].title, "Sensory Avoiding");
  events.forEach(assertValidEvent);
});

test("supervisor documentation produces supervisor observation clinical events", () => {
  const events = normalizeEntry(fixtures.supervisor);
  assert.equal(events.length, 1);
  assert.equal(events[0].category, "supervisor_observation");
  assert.equal(events[0].title, "Team");
  events.forEach(assertValidEvent);
});

test("team focus produces a normalized team focus clinical event", () => {
  const events = normalizeTeamFocus(teamFocus);
  assert.equal(events.length, 1);
  assert.equal(events[0].category, "team_focus");
  assert.equal(events[0].eventType, "team_focus_published");
  events.forEach(assertValidEvent);
});

test("normalization pipeline combines entries and team focus", () => {
  const events = normalizeClinicalEvents({
    entries: Object.values(fixtures),
    teamFocusItems: [teamFocus],
  });
  assert.equal(events.length, 11);
  assert.ok(events.every((event) => event.clientId === clientId));
  events.forEach(assertValidEvent);
});
