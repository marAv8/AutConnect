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
    inProgressEntries: overrides.inProgressEntries ?? [],
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
    ...handoff.sections,
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
  assert.equal(handoff.supportingReferences.length, 1);
  assert.equal(handoff.supportingReferences[0].entryId, btEntry.entryId);
  assert.equal(handoff.supportingReferences[0].sourceCategory, "target_progress");
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

test("empty current day waits without mentioning documentation status", () => {
  const handoff = generateClientDailyHandoff(
    dayContext({ completedEntries: [], clinicalEvents: [], attentionEvents: [] })
  );

  assert.equal(handoff.overview, "No current session summary is available yet.");
  assert.doesNotMatch(handoff.overview, /documentation|provider|in progress/i);
  assert.equal(handoff.completedEntryCount, 0);
  assert.equal(handoff.hasMeaningfulEvents, false);
  assert.equal(handoff.supportingReferences.length, 0);
});

test("live handoff does not expose meaningful in-progress documentation", () => {
  const inProgressEntry = entry({
    entryId: "entry-live-transition",
    sessionObservation:
      "The client transitioned with physical support and then engaged happily.",
  });
  const transition = event({
    id: "event-live-transition",
    entryId: inProgressEntry.entryId,
    category: "abc_observation",
    eventType: "abc_observation_documented",
    title: "Transition response",
    summary:
      "The client transitioned with physical support and then engaged happily.",
    significance: "important",
    tags: ["abc", "transition", "engagement"],
  });

  const handoff = generateClientDailyHandoff(
    dayContext({
      completedEntries: [],
      inProgressEntries: [{ ...inProgressEntry, status: "IN_PROGRESS" }],
      clinicalEvents: [transition],
    })
  );

  assert.equal(handoff.completedEntryCount, 0);
  assert.equal(handoff.inProgressEntryCount, 1);
  assert.equal(handoff.overview, "No current session summary is available yet.");
  assert.equal(handoff.hasMeaningfulEvents, false);
  assert.equal(handoff.sections.length, 0);
  assert.equal(handoff.supportingReferences.length, 0);
  assertTraceable(handoff);
});

test("live handoff keeps all in-progress caregiver and provider content private", () => {
  const caregiverEntry = entry({
    entryId: "entry-live-caregiver",
    providerRole: "Caregiver",
    completedAt: morning,
  });
  const btEntry = entry({
    entryId: "entry-live-bt",
    providerRole: "BehaviorTherapist",
    completedAt: therapy,
    sessionObservation:
      "After the supported transition, the client was happy and engaged and used expressive language.",
  });
  const medication = event({
    id: "event-live-medication",
    entryId: caregiverEntry.entryId,
    providerRole: "Caregiver",
    category: "caregiver_context",
    eventType: "caregiver_medication_context",
    title: "Medication",
    summary: "The caregiver reported that prescribed medication was given.",
    details: { key: "medication", label: "Medication", value: "Given" },
    significance: "important",
  });
  const abc = event({
    id: "event-live-abc",
    entryId: btEntry.entryId,
    category: "abc_observation",
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: "The client resisted the transition.",
    details: {
      antecedent: "The client was dropped off at the front of the school",
      behavior: "Client dropped to the floor and resisted the transition",
      consequence: "The provider supported the transition",
    },
    significance: "important",
  });
  const positiveResponse = event({
    id: "event-live-positive-response",
    entryId: btEntry.entryId,
    category: "provider_observation",
    eventType: "positive_response_observed",
    title: "Positive response observed",
    summary:
      "Behavior therapy observed positive engagement and expressive language following the documented support.",
    details: {
      positiveEngagement: true,
      expressiveCommunication: true,
      transitionContext: true,
    },
    significance: "important",
  });

  const handoff = generateClientDailyHandoff(
    dayContext({
      completedEntries: [],
      inProgressEntries: [
        { ...caregiverEntry, status: "IN_PROGRESS" },
        { ...btEntry, status: "IN_PROGRESS" },
      ],
      clinicalEvents: [medication, abc, positiveResponse],
    })
  );

  assert.equal(handoff.overview, "No current session summary is available yet.");
  assert.equal(handoff.sections.length, 0);
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
  assert.match(
    handoff.sections.find((section) => section.key === "provider-observations")
      .summary,
    /safety-related behavior/i
  );
  assertTraceable(handoff);
});

test("complex interdisciplinary day becomes a natural three-sentence briefing", () => {
  const caregiverEntry = entry({
    entryId: "entry-caregiver-complex",
    providerRole: "Caregiver",
    providerName: "Mona Av",
    completedAt: morning,
  });
  const btEntry = entry({
    entryId: "entry-bt-complex",
    providerRole: "BehaviorTherapist",
    providerName: "tina b",
    completedAt: therapy,
  });
  const slpEntry = entry({
    entryId: "entry-slp-complex",
    providerRole: "SpeechPathologist",
    completedAt: afternoon,
  });
  const otEntry = entry({
    entryId: "entry-ot-complex",
    providerRole: "OccupationalTherapist",
    completedAt: afternoon,
  });
  const sleep = event({
    id: "event-complex-sleep",
    entryId: caregiverEntry.entryId,
    providerRole: "Caregiver",
    providerName: "Mona Av",
    occurredAt: morning,
    category: "caregiver_context",
    eventType: "caregiver_sleep_context",
    title: "Sleep",
    summary: "Mona Av reported sleep: Woke early.",
    details: { key: "sleep", label: "Sleep", value: "Woke early" },
    significance: "important",
  });
  const breakfast = event({
    id: "event-complex-breakfast",
    entryId: caregiverEntry.entryId,
    providerRole: "Caregiver",
    providerName: "Mona Av",
    occurredAt: morning,
    category: "caregiver_context",
    eventType: "caregiver_breakfast_context",
    title: "Breakfast",
    summary: "Mona Av reported breakfast: Skipped.",
    details: { key: "breakfast", label: "Breakfast", value: "Skipped" },
    significance: "important",
  });
  const abc = event({
    id: "event-complex-abc",
    entryId: btEntry.entryId,
    providerRole: "BehaviorTherapist",
    providerName: "tina b",
    occurredAt: therapy,
    category: "abc_observation",
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: "tina b documented a classroom transition concern.",
    details: {
      antecedent: "Waiting for the teacher before the classroom unpacking routine",
      behavior: "Client collapsed to the floor and refused to enter",
      consequence: "Manding was prompted and reinforced before returning to the routine",
    },
    significance: "important",
  });
  const support = event({
    id: "event-complex-support",
    entryId: btEntry.entryId,
    providerRole: "BehaviorTherapist",
    providerName: "tina b",
    occurredAt: therapy,
    category: "target_progress",
    eventType: "behavior_therapy_target_progress",
    title: "Following Classroom Routine",
    summary: "tina b documented full physical prompting for the classroom routine.",
    target: {
      target: "Following Classroom Routine",
      goal: "Follow the classroom unpacking routine",
      measurementProfile: "PromptLevel",
    },
    measurement: { score: 1, direction: "higher_is_better" },
  });
  const communication = event({
    id: "event-complex-communication",
    entryId: slpEntry.entryId,
    providerRole: "SpeechPathologist",
    occurredAt: afternoon,
    category: "communication_observation",
    eventType: "communication_observation_documented",
    title: "Expressive Language Observation",
    summary: "Expressive language targets are being established.",
    significance: "important",
  });
  const grossMotor = event({
    id: "event-complex-gross-motor",
    entryId: otEntry.entryId,
    providerRole: "OccupationalTherapist",
    occurredAt: afternoon,
    category: "sensory_observation",
    eventType: "sensory_observation_documented",
    title: "Gross Motor Observation",
    summary: "Step-to gait needs continued observation on playground equipment.",
    significance: "important",
  });

  const handoff = generateClientDailyHandoff(
    dayContext({
      completedEntries: [caregiverEntry, btEntry, slpEntry, otEntry],
      clinicalEvents: [sleep, breakfast, abc, support, communication, grossMotor],
      attentionEvents: [
        attention({
          id: "attention-complex-abc",
          clinicalEvent: abc,
          attentionType: "behavior_change",
          title: "Transition concern",
        }),
        attention({
          id: "attention-complex-gross-motor",
          clinicalEvent: grossMotor,
          attentionType: "sensory_update",
          title: "Gross motor observation",
        }),
      ],
    })
  );

  assert.match(handoff.overview, /^The caregiver reported that the client skipped breakfast/);
  assert.match(handoff.overview, /skipped breakfast/);
  assert.match(handoff.overview, /experienced difficulty during a classroom transition/);
  assert.match(handoff.overview, /needed full support/);
  assert.match(handoff.overview, /Speech and occupational therapy/);
  assert.doesNotMatch(handoff.overview, /Mona Av|tina b|documented|;/i);
  assert.ok(sentenceCount(handoff.overview) <= 3);
  assert.deepEqual(
    handoff.sections.map((section) => section.title),
    [
      "Home context",
      "Day and session context",
      "Provider observations",
      "Emerging priorities",
    ]
  );
  assert.match(handoff.sections[0].summary, /skipped breakfast and woke early/i);
  assert.match(handoff.sections[1].summary, /needed full support/i);
  assert.doesNotMatch(handoff.sections[2].summary, /collapsed|refused|hit|elop/i);
  assert.equal(
    handoff.supportingReferences.some(
      (reference) => reference.sourceCategory === "attention_event"
    ),
    false
  );
  assertTraceable(handoff);
});

test("caregiver-facing sections stay gentle while safety details remain in sources", () => {
  const caregiverEntry = entry({
    entryId: "entry-gentle-caregiver",
    providerRole: "Caregiver",
    completedAt: morning,
  });
  const btEntry = entry({
    entryId: "entry-gentle-bt",
    providerRole: "BehaviorTherapist",
    completedAt: therapy,
    sessionObservation:
      "Maya screamed, hit the therapist once with an open hand, and attempted to leave during the classroom transition.",
  });
  const caregiverEvents = [
    event({
      id: "event-gentle-breakfast",
      entryId: caregiverEntry.entryId,
      providerRole: "Caregiver",
      category: "caregiver_context",
      eventType: "caregiver_breakfast_context",
      title: "Breakfast",
      summary: "The caregiver reported breakfast: Ate well.",
      details: { key: "breakfast", value: "Ate well" },
      significance: "important",
    }),
    event({
      id: "event-gentle-sleep",
      entryId: caregiverEntry.entryId,
      providerRole: "Caregiver",
      category: "caregiver_context",
      eventType: "caregiver_sleep_context",
      title: "Sleep",
      summary: "The caregiver reported sleep: Good.",
      details: { key: "sleep", value: "Good" },
      significance: "important",
    }),
    event({
      id: "event-gentle-school-transition",
      entryId: caregiverEntry.entryId,
      providerRole: "Caregiver",
      category: "caregiver_context",
      eventType: "caregiver_school_transition_context",
      title: "Transition to school",
      summary: "The caregiver reported a smooth transition to school.",
      details: { key: "schoolTransition", value: "Smooth" },
      significance: "important",
    }),
  ];
  const abc = event({
    id: "event-gentle-abc",
    entryId: btEntry.entryId,
    category: "abc_observation",
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: "Behavior therapy documented a classroom transition concern.",
    details: {
      antecedent: "A classroom transition began",
      behavior:
        "Client screamed, hit the therapist once with an open hand, and attempted to leave",
      consequence: "The therapist provided full support",
    },
    significance: "important",
  });
  const support = event({
    id: "event-gentle-support",
    entryId: btEntry.entryId,
    category: "target_progress",
    eventType: "behavior_therapy_target_progress",
    title: "Following Directions",
    summary: "Full support was required for following directions.",
    target: {
      target: "Following Directions",
      goal: "Follow directions during transitions",
      measurementProfile: "PromptLevel",
    },
    measurement: { score: 1, direction: "higher_is_better" },
  });
  const handoff = generateClientDailyHandoff(
    dayContext({
      completedEntries: [caregiverEntry, btEntry],
      clinicalEvents: [...caregiverEvents, abc, support],
      attentionEvents: [
        attention({
          id: "attention-gentle-safety",
          clinicalEvent: abc,
          attentionType: "safety_concern",
          level: "high",
          title: "Safety-related A-B-C observation",
        }),
      ],
    })
  );

  const home = handoff.sections.find((section) => section.key === "home-context");
  const session = handoff.sections.find(
    (section) => section.key === "session-context"
  );
  const provider = handoff.sections.find(
    (section) => section.key === "provider-observations"
  );
  assert.match(home.summary, /ate well, slept well, and the transition to school was smooth/i);
  assert.match(session.summary, /experienced difficulty during a classroom transition/i);
  assert.match(session.summary, /needed full support for following directions/i);
  assert.match(provider.summary, /safety-related behavior/i);
  assert.doesNotMatch(`${session.summary} ${provider.summary}`, /hit|screamed|attempted to leave/i);
  assert.equal(
    handoff.supportingReferences.some((reference) =>
      /hit the therapist once with an open hand/i.test(reference.snippet)
    ),
    true
  );
  assertTraceable(handoff);
});
