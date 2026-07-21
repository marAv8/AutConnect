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
const { generateClientDailyHandoff } = require("../clientDailyHandoff.ts");

const client = { id: "client-daily-handoff", name: "Suren Dove" };
const clinicalDate = "2026-07-19";
const morning = "2026-07-19T08:00:00.000Z";
const school = "2026-07-19T10:00:00.000Z";
const therapy = "2026-07-19T12:00:00.000Z";
const afternoon = "2026-07-19T14:00:00.000Z";

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

  return {
    id: overrides.id,
    clientId: client.id,
    createdAt: overrides.createdAt ?? clinicalEvent.occurredAt,
    clinicalEventIds: overrides.clinicalEventIds ?? [clinicalEvent.id],
    source: {
      providerId: overrides.providerId ?? clinicalEvent.source.providerId,
      providerName: overrides.providerName ?? clinicalEvent.source.providerName,
      providerRole: overrides.providerRole ?? clinicalEvent.source.providerRole,
    },
    attentionType: overrides.attentionType,
    level: overrides.level ?? "medium",
    title: overrides.title,
    summary: overrides.summary ?? clinicalEvent.summary,
    rationale: overrides.rationale ?? "Documented event should remain visible to the care team.",
    audience: overrides.audience ?? { scope: "entire_team", includeAuthor: true },
    metadata: overrides.metadata,
  };
}

function directive(overrides = {}) {
  return {
    id: overrides.id ?? "directive-team-focus",
    clientId: client.id,
    createdAt: overrides.createdAt ?? morning,
    clinicalEventIds: overrides.clinicalEventIds ?? ["event-team-focus"],
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

function dayContext(overrides) {
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

function sentenceCount(value) {
  return value.split(".").filter((part) => part.trim().length > 0).length;
}

function assertTraceable(handoff) {
  const referenceIds = new Set(handoff.supportingReferences.map((reference) => reference.id));
  for (const item of [
    ...handoff.keyEvents,
    ...handoff.currentConsiderations,
    ...handoff.positiveDevelopments,
  ]) {
    assert.ok(item.sourceReferenceIds.length > 0, `${item.id} has no source references`);
    assert.equal(
      item.sourceReferenceIds.every((id) => referenceIds.has(id)),
      true,
      `${item.id} references a missing source`
    );
  }
}

test("routine day generates a calm concise overview without rich sections", () => {
  const btEntry = entry({ entryId: "entry-bt" });
  const manding = event({
    id: "event-routine",
    entryId: "entry-bt",
    category: "target_progress",
    eventType: "behavior_therapy_target_progress",
    title: "Behavior Therapy Progress: Manding",
    summary: "BehaviorTherapist documented routine manding progress.",
    target: { target: "Manding", goal: "Request preferred item.", measurementProfile: "PromptLevel" },
    tags: ["behavior_therapy", "communication"],
  });

  const handoff = generateClientDailyHandoff(
    dayContext({ completedEntries: [btEntry], clinicalEvents: [manding] })
  );

  assert.equal(handoff.hasMeaningfulEvents, false);
  assert.match(handoff.overview, /routine session activity/);
  assert.equal(handoff.keyEvents.length, 0);
  assert.equal(handoff.currentConsiderations.length, 0);
  assert.equal(handoff.positiveDevelopments.length, 0);
  assert.equal(handoff.supportingReferences.length, 0);
  assert.ok(sentenceCount(handoff.overview) <= 4);
});

test("interdisciplinary day produces central handoff with key events and provider references", () => {
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
  const slpEntry = entry({
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
    tags: ["educator", "transition"],
  });
  const reinforcer = event({
    id: "event-token",
    entryId: "entry-bt",
    providerRole: "BehaviorTherapist",
    occurredAt: therapy,
    category: "reinforcer",
    eventType: "reinforcer_documented",
    title: "Token Economy",
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

  const handoff = generateClientDailyHandoff(
    dayContext({
      completedEntries: [caregiverEntry, educatorEntry, btEntry, slpEntry],
      clinicalEvents: [sleep, transition, reinforcer, communication],
      attentionEvents: [
        attention({
          id: "attention-sleep",
          clinicalEvent: sleep,
          attentionType: "caregiver_context",
          title: "Poor sleep reported",
        }),
        attention({
          id: "attention-token",
          clinicalEvent: reinforcer,
          attentionType: "new_reinforcer",
          title: "Reinforcer documented",
        }),
      ],
    })
  );

  assert.equal(handoff.hasMeaningfulEvents, true);
  assert.match(handoff.overview, /Poor sleep was reported/);
  assert.doesNotMatch(handoff.overview, /Review/);
  assert.doesNotMatch(handoff.overview, /documented/);
  assert.equal(handoff.highestAttentionLevel, "medium");
  assert.equal(handoff.keyEvents.some((item) => item.title === "Reinforcer documented"), true);
  assert.equal(
    handoff.positiveDevelopments.some((item) => item.title === "Reinforcer documented"),
    true
  );
  assertTraceable(handoff);
  assert.ok(sentenceCount(handoff.overview) <= 4);
});

test("active team focus is excluded from the visible client handoff", () => {
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
  const educatorEntry = entry({
    entryId: "entry-educator",
    providerRole: "Educator",
    completedAt: school,
  });
  const transition = event({
    id: "event-transition",
    entryId: "entry-educator",
    providerRole: "Educator",
    category: "target_progress",
    eventType: "academic_target_progress",
    title: "Academic Progress: Classroom Transition",
    summary: "Educator documented transition support.",
    significance: "routine",
    tags: ["transition"],
  });

  const handoff = generateClientDailyHandoff(
    dayContext({
      completedEntries: [educatorEntry],
      clinicalEvents: [focus, transition],
      supervisorDirectives: [focusDirective],
    })
  );

  assert.match(handoff.overview, /routine session activity/);
  assert.equal(handoff.hasMeaningfulEvents, false);
  assert.equal(
    handoff.keyEvents.some((item) => item.title === "Transition Independence"),
    false
  );
  assert.equal(
    handoff.currentConsiderations.some((item) => item.title.includes("Team Focus")),
    false
  );
  assert.equal(
    handoff.supportingReferences.some((reference) => reference.sourceCategory === "team_focus"),
    false
  );
  assertTraceable(handoff);
});

test("provider events drive the handoff when team focus also exists", () => {
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
  const btEntry = entry({
    entryId: "entry-bt",
    providerRole: "BehaviorTherapist",
    completedAt: therapy,
  });
  const reinforcer = event({
    id: "event-reinforcer",
    entryId: "entry-bt",
    providerRole: "BehaviorTherapist",
    category: "reinforcer",
    eventType: "reinforcer_documented",
    title: "Token Economy",
    summary: "Token board was effective during table work.",
    significance: "important",
    tags: ["reinforcer"],
  });

  const handoff = generateClientDailyHandoff(
    dayContext({
      completedEntries: [btEntry],
      clinicalEvents: [focus, reinforcer],
      supervisorDirectives: [focusDirective],
      attentionEvents: [
        attention({
          id: "attention-reinforcer",
          clinicalEvent: reinforcer,
          attentionType: "new_reinforcer",
          title: "Reinforcer documented",
        }),
      ],
    })
  );

  assert.match(handoff.overview, /^Token board was effective/);
  assert.doesNotMatch(handoff.overview, /documented/);
  assert.doesNotMatch(handoff.overview, /Active Team Focus/);
  assert.equal(handoff.keyEvents[0].title, "Reinforcer documented");
  assert.equal(
    handoff.keyEvents.some((item) => item.title === "Transition Independence"),
    false
  );
  assert.equal(
    handoff.currentConsiderations.some((item) => item.title.includes("Team Focus")),
    false
  );
  assert.equal(
    handoff.supportingReferences.some((reference) => reference.sourceCategory === "team_focus"),
    false
  );
  assertTraceable(handoff);
});

test("empty current day explains that the live handoff will update after completion", () => {
  const handoff = generateClientDailyHandoff(
    dayContext({ completedEntries: [], clinicalEvents: [], attentionEvents: [] })
  );

  assert.match(handoff.overview, /no completed provider documentation yet/);
  assert.equal(handoff.completedEntryCount, 0);
  assert.equal(handoff.hasMeaningfulEvents, false);
  assert.equal(handoff.supportingReferences.length, 0);
});

test("safety attention becomes the highest level and remains traceable", () => {
  const btEntry = entry({ entryId: "entry-bt", providerRole: "BehaviorTherapist" });
  const safety = event({
    id: "event-safety",
    entryId: "entry-bt",
    providerRole: "BehaviorTherapist",
    category: "abc_observation",
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: "BehaviorTherapist documented elopement after transition demand.",
    significance: "important",
    tags: ["abc", "safety"],
  });

  const handoff = generateClientDailyHandoff(
    dayContext({
      completedEntries: [btEntry],
      clinicalEvents: [safety],
      attentionEvents: [
        attention({
          id: "attention-safety",
          clinicalEvent: safety,
          attentionType: "safety_concern",
          level: "high",
          title: "Safety-related A-B-C observation",
        }),
      ],
    })
  );

  assert.equal(handoff.highestAttentionLevel, "high");
  assert.equal(handoff.keyEvents[0].title, "Safety-related A-B-C observation");
  assert.equal(handoff.currentConsiderations[0].title, "Safety-related A-B-C observation");
  assertTraceable(handoff);
});
