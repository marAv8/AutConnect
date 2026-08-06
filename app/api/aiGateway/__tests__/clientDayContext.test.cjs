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

const { createClientDayContext } = require("../clientDayContext.ts");

const client = { id: "client-day", name: "Suren Dove" };
const clinicalDate = "2026-07-19";
const morning = "2026-07-19T08:00:00.000Z";
const school = "2026-07-19T10:00:00.000Z";
const therapy = "2026-07-19T12:00:00.000Z";
const afternoon = "2026-07-19T14:00:00.000Z";
const previousDate = "2026-07-18";

function entry(overrides) {
  const role = overrides.providerRole ?? "BehaviorTherapist";
  const providerId = overrides.providerId ?? `provider-${role.toLowerCase()}`;
  const entryId = overrides.entryId ?? `entry-${role.toLowerCase()}`;
  const completedAt = overrides.completedAt ?? overrides.occurredAt ?? therapy;

  return {
    entryId,
    clientId: client.id,
    providerId,
    providerName: overrides.providerName ?? `${role} Provider`,
    providerRole: role,
    kind: overrides.kind ?? "SessionNote",
    visibility: overrides.visibility ?? "Shared",
    sessionObservation: overrides.sessionObservation ?? null,
    clinicalDate: overrides.clinicalDate ?? clinicalDate,
    occurredAt: overrides.occurredAt ?? completedAt,
    completedAt,
    revisionNumber: overrides.revisionNumber,
    revisedAt: overrides.revisedAt,
    revisionChangeLabels: overrides.revisionChangeLabels,
  };
}

function event(overrides) {
  const role = overrides.providerRole ?? "BehaviorTherapist";
  const providerId = overrides.providerId ?? `provider-${role.toLowerCase()}`;

  return {
    id: overrides.id,
    clientId: client.id,
    occurredAt: overrides.occurredAt ?? therapy,
    source: {
      sourceType: overrides.sourceType ?? "entry",
      entryId: overrides.entryId,
      itemId: overrides.itemId,
      providerId,
      providerName: overrides.providerName ?? `${role} Provider`,
      providerRole: role,
      entryKind: overrides.entryKind ?? "SessionNote",
    },
    category: overrides.category,
    eventType: overrides.eventType,
    title: overrides.title,
    summary: overrides.summary,
    target: overrides.target,
    measurement: overrides.measurement,
    details: overrides.details,
    significance: overrides.significance ?? "routine",
    tags: overrides.tags ?? [overrides.category],
  };
}

function attention(overrides) {
  const clinicalEvent = overrides.clinicalEvent;
  const role = overrides.providerRole ?? clinicalEvent.source.providerRole;

  return {
    id: overrides.id,
    clientId: client.id,
    createdAt: overrides.createdAt ?? clinicalEvent.occurredAt,
    clinicalEventIds: overrides.clinicalEventIds ?? [clinicalEvent.id],
    source: {
      providerId: overrides.providerId ?? clinicalEvent.source.providerId,
      providerName: overrides.providerName ?? clinicalEvent.source.providerName,
      providerRole: role,
    },
    attentionType: overrides.attentionType,
    level: overrides.level ?? "medium",
    title: overrides.title,
    summary: overrides.summary ?? clinicalEvent.summary,
    rationale: overrides.rationale ?? "Deterministic attention rationale.",
    audience: overrides.audience ?? { scope: "entire_team", includeAuthor: true },
    metadata: overrides.metadata,
  };
}

function directive(overrides = {}) {
  const teamFocusEventId = overrides.clinicalEventIds?.[0] ?? "event-team-focus";
  return {
    id: overrides.id ?? "directive-team-focus",
    clientId: client.id,
    createdAt: overrides.createdAt ?? morning,
    clinicalEventIds: [teamFocusEventId],
    source: {
      providerId: "provider-supervisor",
      providerName: "Supervisor Provider",
      providerRole: "Supervisor",
    },
    directiveType: "team_focus",
    level: overrides.level ?? "important",
    title: overrides.title ?? "Transition Independence",
    summary: overrides.summary ?? "Reduce transition support across school settings.",
    rationale: overrides.rationale ?? "Active Team Focus.",
    audience: { scope: "entire_team", includeAuthor: true },
    status: { lifecycle: "active_until_replaced" },
    metadata: overrides.metadata,
  };
}

function context(overrides) {
  return createClientDayContext({
    client,
    date: overrides.date ?? clinicalDate,
    status: overrides.status ?? "LIVE",
    completedEntries: overrides.completedEntries ?? [],
    clinicalEvents: overrides.clinicalEvents ?? [],
    attentionEvents: overrides.attentionEvents ?? [],
    supervisorDirectives: overrides.supervisorDirectives ?? [],
    generatedAt: "2026-07-19T23:00:00.000Z",
  });
}

test("routine single-provider day stays low-detail and traceable", () => {
  const btEntry = entry({ entryId: "entry-bt", completedAt: therapy });
  const manding = event({
    id: "event-manding",
    entryId: "entry-bt",
    category: "target_progress",
    eventType: "behavior_therapy_target_progress",
    title: "Behavior Therapy Progress: Manding",
    summary: "BehaviorTherapist documented Manding with expected prompting.",
    target: { target: "Manding", goal: "Request preferred item.", measurementProfile: "PromptLevel" },
    measurement: { metricType: "Subjective", score: 3, label: "PromptLevel" },
    tags: ["behavior_therapy", "communication"],
  });

  const result = context({ completedEntries: [btEntry], clinicalEvents: [manding] });

  assert.equal(result.completedEntryCount, 1);
  assert.equal(result.highestAttentionLevel, null);
  assert.equal(result.meaningfulEventCount, 0);
  assert.equal(result.routineEventCount, 1);
  assert.deepEqual(result.contributingProviderRoles, ["BehaviorTherapist"]);
  assert.equal(result.sourceReferences.some((reference) => reference.entryId === "entry-bt"), true);
});

test("marks revised documentation without duplicating the prior note", () => {
  const revised = entry({
    entryId: "entry-revised",
    completedAt: therapy,
    sessionObservation: "Client transitioned with one reminder.",
    revisionNumber: 2,
    revisedAt: "2026-07-19T13:00:00.000Z",
    revisionChangeLabels: ["Provider note", "Targets and responses"],
  });

  const result = context({ completedEntries: [revised] });
  const reference = result.sourceReferences[0];

  assert.equal(reference.label, "Updated Session Observation");
  assert.equal(reference.snippet, "Client transitioned with one reminder.");
  assert.equal(reference.revisionNumber, 2);
  assert.deepEqual(reference.revisionChangeLabels, [
    "Provider note",
    "Targets and responses",
  ]);
});

test("interdisciplinary day orders sources and preserves provider roles", () => {
  const caregiverEntry = entry({
    entryId: "entry-caregiver",
    providerRole: "Caregiver",
    completedAt: morning,
  });
  const educatorEntry = entry({
    entryId: "entry-educator",
    providerRole: "Educator",
    completedAt: school,
  });
  const btEntry = entry({
    entryId: "entry-bt",
    providerRole: "BehaviorTherapist",
    completedAt: therapy,
  });
  const speechEntry = entry({
    entryId: "entry-slp",
    providerRole: "SpeechPathologist",
    completedAt: afternoon,
    kind: "CommunicationObservation",
  });
  const sleep = event({
    id: "event-sleep",
    entryId: "entry-caregiver",
    providerRole: "Caregiver",
    occurredAt: morning,
    category: "caregiver_context",
    eventType: "caregiver_sleep_context",
    title: "Sleep",
    summary: "Caregiver reported sleep: poor.",
    significance: "important",
    tags: ["caregiver", "sleep"],
  });
  const transition = event({
    id: "event-transition",
    entryId: "entry-educator",
    providerRole: "Educator",
    occurredAt: school,
    category: "target_progress",
    eventType: "academic_target_progress",
    title: "Academic Progress: Classroom Transition",
    summary: "Educator documented increased prompting during transition.",
    significance: "routine",
    tags: ["educator", "transition"],
  });
  const reinforcer = event({
    id: "event-reinforcer",
    entryId: "entry-bt",
    providerRole: "BehaviorTherapist",
    occurredAt: therapy,
    category: "reinforcer",
    eventType: "reinforcer_documented",
    title: "Reinforcer Documented",
    summary: "Token board was effective during table work.",
    significance: "important",
    tags: ["reinforcer", "token"],
  });
  const communication = event({
    id: "event-communication",
    entryId: "entry-slp",
    providerRole: "SpeechPathologist",
    occurredAt: afternoon,
    category: "communication_observation",
    eventType: "communication_observation_documented",
    title: "Spontaneous Requesting",
    summary: "Client initiated two spontaneous requests.",
    significance: "important",
    tags: ["speech", "communication"],
  });

  const result = context({
    completedEntries: [speechEntry, caregiverEntry, btEntry, educatorEntry],
    clinicalEvents: [communication, transition, reinforcer, sleep],
    attentionEvents: [
      attention({
        id: "attention-reinforcer",
        clinicalEvent: reinforcer,
        attentionType: "new_reinforcer",
        title: "Reinforcer documented",
      }),
    ],
  });

  assert.deepEqual(result.completedEntries.map((item) => item.entryId), [
    "entry-caregiver",
    "entry-educator",
    "entry-bt",
    "entry-slp",
  ]);
  assert.deepEqual(result.contributingProviderRoles, [
    "BehaviorTherapist",
    "Caregiver",
    "Educator",
    "SpeechPathologist",
  ]);
  assert.equal(result.caregiverContext.length, 1);
  assert.equal(result.reinforcerObservations.length, 1);
  assert.equal(result.highestAttentionLevel, "medium");
});

test("clinical events from in-progress entries are excluded when the entry is not completed", () => {
  const completed = entry({ entryId: "entry-completed", completedAt: therapy });
  const completedEvent = event({
    id: "event-completed",
    entryId: "entry-completed",
    category: "target_progress",
    eventType: "behavior_therapy_target_progress",
    title: "Behavior Therapy Progress: Matching",
    summary: "Completed target documentation.",
  });
  const draftEvent = event({
    id: "event-draft",
    entryId: "entry-draft",
    category: "communication_observation",
    eventType: "communication_observation_documented",
    title: "Draft Communication",
    summary: "This in-progress event should not leak.",
    significance: "important",
  });

  const result = context({
    completedEntries: [completed],
    clinicalEvents: [draftEvent, completedEvent],
    attentionEvents: [
      attention({
        id: "attention-draft",
        clinicalEvent: draftEvent,
        attentionType: "communication_update",
        title: "Draft attention",
      }),
    ],
  });

  assert.deepEqual(result.clinicalEvents.map((item) => item.id), ["event-completed"]);
  assert.equal(result.attentionEvents.length, 0);
  assert.equal(
    result.sourceReferences.some((reference) => reference.snippet.includes("should not leak")),
    false
  );
});

test("observation-only completed note contributes without targets", () => {
  const otEntry = entry({
    entryId: "entry-ot",
    providerRole: "OccupationalTherapist",
    kind: "SensoryObservation",
    completedAt: afternoon,
  });
  const sensory = event({
    id: "event-sensory",
    entryId: "entry-ot",
    providerRole: "OccupationalTherapist",
    category: "sensory_observation",
    eventType: "sensory_observation_documented",
    title: "Noise Sensitivity",
    summary: "Client covered ears during cafeteria transition.",
    significance: "important",
    tags: ["sensory", "noise"],
  });

  const result = context({ completedEntries: [otEntry], clinicalEvents: [sensory] });

  assert.equal(result.completedEntryCount, 1);
  assert.equal(result.meaningfulEventCount, 1);
  assert.equal(result.sourceReferences[0].sectionKey, "sensory-observations");
});

test("reinforcer traceability preserves provider, entry, timestamp, and source category", () => {
  const btEntry = entry({
    entryId: "entry-bt",
    providerRole: "BehaviorTherapist",
    completedAt: therapy,
  });
  const reinforcer = event({
    id: "event-token",
    entryId: "entry-bt",
    itemId: "reinforcer-token",
    providerRole: "BehaviorTherapist",
    category: "reinforcer",
    eventType: "reinforcer_documented",
    title: "Token Economy",
    summary: "Token board was effective during table work.",
    significance: "important",
    tags: ["reinforcer", "token"],
  });

  const result = context({ completedEntries: [btEntry], clinicalEvents: [reinforcer] });
  const source = result.reinforcerObservations[0];

  assert.equal(source.entryId, "entry-bt");
  assert.equal(source.providerRole, "BehaviorTherapist");
  assert.equal(source.completedAt, therapy);
  assert.equal(source.sourceCategory, "reinforcer");
  assert.equal(source.sourceItemId, "reinforcer-token");
});

test("team focus creates a client-level source item and supervisor directive", () => {
  const focus = event({
    id: "event-team-focus",
    sourceType: "team_focus",
    providerId: "provider-supervisor",
    providerName: "Supervisor Provider",
    providerRole: "Supervisor",
    entryId: undefined,
    category: "team_focus",
    eventType: "team_focus_published",
    title: "Transition Independence",
    summary: "Reduce transition support across school settings.",
    significance: "important",
    tags: ["team_focus"],
  });
  const focusDirective = directive({ clinicalEventIds: ["event-team-focus"] });

  const result = context({
    completedEntries: [],
    clinicalEvents: [focus],
    supervisorDirectives: [focusDirective],
  });

  assert.equal(result.teamFocus.sourceCategory, "team_focus");
  assert.equal(result.supervisorDirectives.length, 1);
  assert.equal(result.sourceReferences.some((reference) => reference.directiveIds?.length === 1), true);
});

test("highest attention level is derived without good or bad day scoring", () => {
  const sleepEntry = entry({
    entryId: "entry-caregiver",
    providerRole: "Caregiver",
    completedAt: morning,
  });
  const safetyEntry = entry({
    entryId: "entry-bt",
    providerRole: "BehaviorTherapist",
    completedAt: therapy,
  });
  const sleep = event({
    id: "event-sleep",
    entryId: "entry-caregiver",
    providerRole: "Caregiver",
    category: "caregiver_context",
    eventType: "caregiver_sleep_context",
    title: "Sleep",
    summary: "Caregiver reported poor sleep.",
    significance: "important",
  });
  const safety = event({
    id: "event-safety",
    entryId: "entry-bt",
    providerRole: "BehaviorTherapist",
    category: "abc_observation",
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: "Safety-related behavior documented.",
    significance: "important",
  });

  const result = context({
    completedEntries: [sleepEntry, safetyEntry],
    clinicalEvents: [sleep, safety],
    attentionEvents: [
      attention({
        id: "attention-sleep",
        clinicalEvent: sleep,
        attentionType: "caregiver_context",
        level: "medium",
        title: "Poor sleep reported",
      }),
      attention({
        id: "attention-safety",
        clinicalEvent: safety,
        attentionType: "safety_concern",
        level: "high",
        title: "Safety-related A-B-C observation",
      }),
    ],
  });

  assert.equal(result.highestAttentionLevel, "high");
  assert.equal("score" in result, false);
  assert.equal("goodDay" in result, false);
  assert.equal("badDay" in result, false);
});

test("late completed entry for a prior date remains finalized and recomputes deterministically", () => {
  const lateEntry = entry({
    entryId: "entry-late",
    providerRole: "SpeechPathologist",
    clinicalDate: previousDate,
    occurredAt: "2026-07-18T11:00:00.000Z",
    completedAt: "2026-07-19T16:00:00.000Z",
    kind: "CommunicationObservation",
  });
  const lateEvent = event({
    id: "event-late",
    entryId: "entry-late",
    providerRole: "SpeechPathologist",
    occurredAt: "2026-07-18T11:00:00.000Z",
    category: "communication_observation",
    eventType: "communication_observation_documented",
    title: "AAC Use",
    summary: "Client used AAC to request a preferred item.",
    significance: "important",
  });

  const result = context({
    date: previousDate,
    status: "FINALIZED",
    completedEntries: [lateEntry],
    clinicalEvents: [lateEvent],
  });

  assert.equal(result.status, "FINALIZED");
  assert.equal(result.completedEntryCount, 1);
  assert.equal(result.sourceReferences[0].entryId, "entry-late");
  assert.equal(result.sourceReferences[0].completedAt, "2026-07-19T16:00:00.000Z");
});
