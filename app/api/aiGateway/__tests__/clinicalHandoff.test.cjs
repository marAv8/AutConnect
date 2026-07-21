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

const { generateClinicalHandoff } = require("../clinicalHandoff.ts");

const clientId = "client-handoff";
const now = "2026-07-16T12:00:00.000Z";
const morning = "2026-07-16T08:00:00.000Z";
const yesterday = "2026-07-15T12:00:00.000Z";

function provider(role, id = role.toLowerCase()) {
  return {
    id: `provider-${id}`,
    name: `${role} Provider`,
    role,
  };
}

function event(overrides) {
  const role = overrides.providerRole ?? "BehaviorTherapist";
  const providerId = overrides.providerId ?? `provider-${role.toLowerCase()}`;

  return {
    id: overrides.id,
    clientId,
    occurredAt: overrides.occurredAt ?? now,
    source: {
      sourceType: overrides.sourceType ?? "entry",
      entryId: overrides.entryId ?? "entry-current",
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
  const role = overrides.providerRole ?? clinicalEvent?.source.providerRole ?? "BehaviorTherapist";

  return {
    id: overrides.id,
    clientId,
    createdAt: overrides.createdAt ?? now,
    clinicalEventIds: overrides.clinicalEventIds ?? [clinicalEvent.id],
    source: {
      providerId: overrides.providerId ?? clinicalEvent?.source.providerId ?? `provider-${role}`,
      providerName: overrides.providerName ?? clinicalEvent?.source.providerName ?? `${role} Provider`,
      providerRole: role,
    },
    attentionType: overrides.attentionType,
    level: overrides.level ?? "medium",
    title: overrides.title,
    summary: overrides.summary ?? clinicalEvent.summary,
    rationale: overrides.rationale ?? "Deterministic validation rationale.",
    audience: overrides.audience ?? { scope: "entire_team", includeAuthor: true },
    metadata: overrides.metadata,
  };
}

function teamFocusDirective(overrides = {}) {
  return {
    id: overrides.id ?? "directive-team-focus",
    clientId,
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
    summary:
      overrides.summary ??
      "Reduce transition behaviors across school and therapy settings.",
    rationale:
      overrides.rationale ??
      "Team Focus is supervisory direction and persists until replaced.",
    audience: { scope: "entire_team", includeAuthor: true },
    status: { lifecycle: "active_until_replaced" },
    metadata: overrides.metadata,
  };
}

function previousSession(entryId, role, clinicalEvents) {
  return {
    entryId,
    date: yesterday,
    kind: "SessionNote",
    provider: provider(role),
    clinicalEvents,
  };
}

function context(overrides) {
  const activeTeamFocus = overrides.activeTeamFocus ?? null;
  const supervisorDirectives = activeTeamFocus
    ? [activeTeamFocus, ...(overrides.supervisorDirectives ?? [])]
    : overrides.supervisorDirectives ?? [];

  return {
    client: { id: clientId, name: "Suren Dove" },
    session: {
      entryId: overrides.entryId ?? "entry-current",
      date: now,
      kind: overrides.kind ?? "SessionNote",
    },
    provider: overrides.provider ?? provider(overrides.providerRole ?? "BehaviorTherapist"),
    clinicalEvents: overrides.clinicalEvents ?? [],
    attentionEvents: overrides.attentionEvents ?? [],
    supervisorDirectives,
    activeTeamFocus,
    sessionObservation: overrides.sessionObservation ?? null,
    previousSessions: overrides.previousSessions ?? [],
    providerHistory: overrides.providerHistory ?? [],
    historicalPatterns: overrides.historicalPatterns ?? {
      recurringAntecedents: [],
      recurringTargets: [],
      repeatedAttentionEvents: [],
      recentProviderObservations: [],
    },
  };
}

function sentenceCount(summary) {
  return summary.split(".").filter((part) => part.trim().length > 0).length;
}

function assertConcise(handoff) {
  assert.ok(sentenceCount(handoff.summary) <= 5);
  assert.ok(handoff.importantEvents.length <= 6);
  assert.ok(handoff.careTeamConnections.length <= 4);
  assert.ok(handoff.watchItems.length <= 5);
  assert.ok(handoff.carryForwardItems.length <= 5);
}

test("routine behavior therapy session stays low signal", () => {
  const progress = event({
    id: "event-routine-bt",
    category: "target_progress",
    eventType: "behavior_therapy_target_progress",
    title: "Behavior Therapy Progress: Manding",
    summary: "BehaviorTherapist documented Manding: requested preferred item with minimal prompting.",
    target: { target: "Manding", goal: "Request preferred item.", measurementProfile: "PromptLevel" },
    measurement: { metricType: "Subjective", score: 3, label: "PromptLevel" },
    tags: ["behavior_therapy", "communication"],
  });

  const handoff = generateClinicalHandoff(context({ clinicalEvents: [progress] }));

  assert.equal(handoff.confidence, "low");
  assert.equal(handoff.importantEvents.length, 0);
  assert.equal(handoff.careTeamConnections.length, 0);
  assert.equal(handoff.watchItems.length, 0);
  assert.equal(handoff.carryForwardItems.length, 0);
  assert.match(handoff.summary, /without generated attention events/);
  assertConcise(handoff);
});

test("poor sleep followed by increased prompting creates a care team connection", () => {
  const poorSleep = event({
    id: "event-poor-sleep",
    occurredAt: morning,
    providerRole: "Caregiver",
    category: "caregiver_context",
    eventType: "caregiver_sleep_context",
    title: "Sleep",
    summary: "Caregiver reported sleep: poor.",
    details: { key: "sleep", value: "poor" },
    significance: "important",
    tags: ["caregiver", "sleep"],
  });
  const prompting = event({
    id: "event-school-prompting",
    providerRole: "Educator",
    category: "target_progress",
    eventType: "academic_target_progress",
    title: "Academic Progress: Classroom Transition",
    summary: "Educator documented Classroom Transition: moderate prompting required.",
    target: {
      target: "Classroom Transition",
      goal: "Transition with reduced prompting.",
      measurementProfile: "PromptLevel",
    },
    measurement: { metricType: "Subjective", score: 2, label: "PromptLevel" },
    tags: ["educator", "transition"],
  });
  const promptingAttention = attention({
    id: "attention-prompting",
    clinicalEvent: prompting,
    attentionType: "increased_support",
    title: "Prompting increased",
    rationale: "Current prompt level indicates more support than the recent comparable event.",
  });

  const handoff = generateClinicalHandoff(
    context({
      providerRole: "Educator",
      clinicalEvents: [prompting],
      attentionEvents: [promptingAttention],
      previousSessions: [previousSession("entry-caregiver", "Caregiver", [poorSleep])],
    })
  );

  assert.equal(handoff.confidence, "high");
  assert.equal(handoff.importantEvents[0].title, "Prompting increased");
  assert.equal(handoff.careTeamConnections[0].connectionType, "caregiver_context");
  assert.match(handoff.careTeamConnections[0].summary, /Caregiver documented Sleep/);
  assert.equal(handoff.watchItems[0].title, "Prompting increased");
  assertConcise(handoff);
});

test("new reinforcer carries forward and connects with another provider observation", () => {
  const historicalReinforcer = event({
    id: "event-educator-reinforcer",
    occurredAt: yesterday,
    providerRole: "Educator",
    category: "reinforcer",
    eventType: "reinforcer_documented",
    title: "Token Economy",
    summary: "Educator documented token economy improved transition engagement.",
    significance: "important",
    tags: ["reinforcer", "transition"],
  });
  const currentReinforcer = event({
    id: "event-bt-reinforcer",
    providerRole: "BehaviorTherapist",
    category: "reinforcer",
    eventType: "reinforcer_documented",
    title: "Token Economy",
    summary: "BehaviorTherapist documented token economy as an effective reinforcer.",
    significance: "important",
    tags: ["reinforcer", "transition"],
  });
  const reinforcerAttention = attention({
    id: "attention-reinforcer",
    clinicalEvent: currentReinforcer,
    attentionType: "new_reinforcer",
    title: "Reinforcer documented",
  });

  const handoff = generateClinicalHandoff(
    context({
      clinicalEvents: [currentReinforcer],
      attentionEvents: [reinforcerAttention],
      previousSessions: [previousSession("entry-educator", "Educator", [historicalReinforcer])],
    })
  );

  assert.equal(handoff.importantEvents[0].title, "Reinforcer documented");
  assert.equal(handoff.careTeamConnections[0].connectionType, "shared_category");
  assert.ok(handoff.carryForwardItems.some((item) => item.title === "Reinforcer documented"));
  assertConcise(handoff);
});

test("active Team Focus is prioritized when current observations support it", () => {
  const directive = teamFocusDirective();
  const transitionEvent = event({
    id: "event-transition",
    providerRole: "BehaviorTherapist",
    category: "target_progress",
    eventType: "behavior_therapy_target_progress",
    title: "Behavior Therapy Progress: Transition Independence",
    summary: "BehaviorTherapist documented transition independence during therapy.",
    target: {
      target: "Transition Independence",
      goal: "Transition independently.",
      measurementProfile: "Independence",
    },
    significance: "routine",
    tags: ["transition", "therapy"],
  });

  const handoff = generateClinicalHandoff(
    context({
      activeTeamFocus: directive,
      clinicalEvents: [transitionEvent],
    })
  );

  assert.equal(handoff.importantEvents[0].source, "supervisor_directive");
  assert.equal(handoff.watchItems[0].source, "team_focus");
  assert.equal(handoff.carryForwardItems[0].source, "team_focus");
  assert.equal(handoff.careTeamConnections[0].connectionType, "team_focus_alignment");
  assert.match(handoff.summary, /^Active Team Focus:/);
  assertConcise(handoff);
});

test("multiple providers documenting the same emerging concern produces a concise connection", () => {
  const historicalSensory = event({
    id: "event-educator-sensory",
    occurredAt: yesterday,
    providerRole: "Educator",
    category: "sensory_observation",
    eventType: "sensory_observation_documented",
    title: "Loud Environment",
    summary: "Educator documented covering ears during loud transition.",
    significance: "important",
    tags: ["sensory", "transition"],
  });
  const currentSensory = event({
    id: "event-ot-sensory",
    providerRole: "OccupationalTherapist",
    category: "sensory_observation",
    eventType: "sensory_observation_documented",
    title: "Loud Environment",
    summary: "OccupationalTherapist documented auditory sensitivity during transition.",
    significance: "important",
    tags: ["sensory", "transition"],
  });
  const sensoryAttention = attention({
    id: "attention-sensory",
    clinicalEvent: currentSensory,
    attentionType: "sensory_concern",
    title: "New sensory observation",
  });

  const handoff = generateClinicalHandoff(
    context({
      providerRole: "OccupationalTherapist",
      clinicalEvents: [currentSensory],
      attentionEvents: [sensoryAttention],
      previousSessions: [previousSession("entry-educator", "Educator", [historicalSensory])],
    })
  );

  assert.equal(handoff.confidence, "high");
  assert.equal(handoff.careTeamConnections.length, 1);
  assert.equal(handoff.careTeamConnections[0].connectionType, "shared_category");
  assert.match(handoff.summary, /Care team connection/);
  assertConcise(handoff);
});

test("different documented observations connect without inventing conflict", () => {
  const historicalCommunication = event({
    id: "event-educator-aac",
    occurredAt: yesterday,
    providerRole: "Educator",
    category: "communication_observation",
    eventType: "communication_observation_documented",
    title: "AAC",
    summary: "Educator documented AAC use during morning activity.",
    significance: "important",
    tags: ["communication", "aac"],
  });
  const currentCommunication = event({
    id: "event-slp-aac",
    providerRole: "SpeechPathologist",
    category: "communication_observation",
    eventType: "communication_observation_documented",
    title: "AAC",
    summary: "SpeechPathologist documented refusal to use AAC during direct therapy.",
    significance: "important",
    tags: ["communication", "aac"],
  });
  const communicationAttention = attention({
    id: "attention-communication",
    clinicalEvent: currentCommunication,
    attentionType: "communication_update",
    title: "Communication update",
  });

  const handoff = generateClinicalHandoff(
    context({
      providerRole: "SpeechPathologist",
      clinicalEvents: [currentCommunication],
      attentionEvents: [communicationAttention],
      previousSessions: [
        previousSession("entry-educator", "Educator", [historicalCommunication]),
      ],
    })
  );

  assert.equal(handoff.careTeamConnections[0].connectionType, "shared_category");
  assert.doesNotMatch(handoff.summary, /conflict|contradict|inconsistent/i);
  assert.ok(handoff.carryForwardItems.some((item) => item.title === "Communication update"));
  assertConcise(handoff);
});

test("high-priority safety concern is surfaced first with high confidence", () => {
  const safetyEvent = event({
    id: "event-abc-safety",
    providerRole: "BehaviorTherapist",
    category: "abc_observation",
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: "BehaviorTherapist documented verbal aggression after peer interaction.",
    details: {
      antecedent: "Peer interaction",
      behavior: "Verbal aggression",
      consequence: "Redirected to task",
    },
    significance: "important",
    tags: ["abc", "safety", "aggression"],
  });
  const safetyAttention = attention({
    id: "attention-safety",
    clinicalEvent: safetyEvent,
    attentionType: "safety_concern",
    level: "high",
    title: "Safety-related A-B-C observation",
    rationale: "A-B-C data includes behavior language associated with safety risk.",
  });

  const handoff = generateClinicalHandoff(
    context({ clinicalEvents: [safetyEvent], attentionEvents: [safetyAttention] })
  );

  assert.equal(handoff.confidence, "high");
  assert.equal(handoff.importantEvents[0].title, "Safety-related A-B-C observation");
  assert.equal(handoff.watchItems[0].level, "high");
  assert.equal(handoff.carryForwardItems[0].source, "attention_event");
  assertConcise(handoff);
});

test("rich interdisciplinary day remains concise and prioritizes interdisciplinary context", () => {
  const directive = teamFocusDirective({
    summary: "Support independent transitions using consistent visual and sensory strategies.",
  });
  const educatorTransition = event({
    id: "event-educator-transition",
    occurredAt: yesterday,
    providerRole: "Educator",
    category: "target_progress",
    eventType: "academic_target_progress",
    title: "Academic Progress: Transition Independence",
    summary: "Educator documented transition independence with moderate prompting.",
    target: {
      target: "Transition Independence",
      goal: "Transition with reduced support.",
      measurementProfile: "PromptLevel",
    },
    measurement: { metricType: "Subjective", score: 2 },
    tags: ["educator", "transition"],
  });
  const slpAac = event({
    id: "event-slp-aac",
    occurredAt: yesterday,
    providerRole: "SpeechPathologist",
    category: "communication_observation",
    eventType: "communication_observation_documented",
    title: "AAC",
    summary: "SpeechPathologist documented AAC requesting before transition.",
    significance: "important",
    tags: ["communication", "transition"],
  });
  const otSensory = event({
    id: "event-ot-sensory",
    occurredAt: yesterday,
    providerRole: "OccupationalTherapist",
    category: "sensory_observation",
    eventType: "sensory_observation_documented",
    title: "Sensory Break",
    summary: "OccupationalTherapist documented sensory break before transition.",
    significance: "important",
    tags: ["sensory", "transition"],
  });
  const btTransition = event({
    id: "event-bt-transition",
    providerRole: "BehaviorTherapist",
    category: "target_progress",
    eventType: "behavior_therapy_target_progress",
    title: "Behavior Therapy Progress: Transition Independence",
    summary: "BehaviorTherapist documented improved transition engagement after token economy.",
    target: {
      target: "Transition Independence",
      goal: "Transition with reduced support.",
      measurementProfile: "PromptLevel",
    },
    measurement: { metricType: "Subjective", score: 3 },
    significance: "routine",
    tags: ["behavior_therapy", "transition", "token"],
  });
  const reinforcer = event({
    id: "event-token-reinforcer",
    providerRole: "BehaviorTherapist",
    category: "reinforcer",
    eventType: "reinforcer_documented",
    title: "Token Economy",
    summary: "BehaviorTherapist documented token economy supported transition engagement.",
    significance: "important",
    tags: ["reinforcer", "transition", "token"],
  });
  const reinforcerAttention = attention({
    id: "attention-token",
    clinicalEvent: reinforcer,
    attentionType: "new_reinforcer",
    title: "Reinforcer documented",
  });

  const handoff = generateClinicalHandoff(
    context({
      activeTeamFocus: directive,
      clinicalEvents: [btTransition, reinforcer],
      attentionEvents: [reinforcerAttention],
      sessionObservation: "Token economy was effective during transition practice.",
      previousSessions: [
        previousSession("entry-educator", "Educator", [educatorTransition]),
        previousSession("entry-slp", "SpeechPathologist", [slpAac]),
        previousSession("entry-ot", "OccupationalTherapist", [otSensory]),
      ],
      historicalPatterns: {
        recurringAntecedents: [],
        recurringTargets: [
          {
            value: "Transition Independence",
            count: 2,
            clinicalEventIds: ["event-educator-transition", "event-bt-transition"],
            lastObservedAt: now,
            sourceProviderRoles: ["Educator", "BehaviorTherapist"],
          },
        ],
        repeatedAttentionEvents: [],
        recentProviderObservations: [],
      },
    })
  );

  assert.equal(handoff.confidence, "high");
  assert.equal(handoff.importantEvents[0].source, "supervisor_directive");
  assert.ok(handoff.careTeamConnections.length >= 1);
  assert.ok(handoff.carryForwardItems.some((item) => item.title === "Token Economy"));
  assert.match(handoff.summary, /Active Team Focus/);
  assertConcise(handoff);
});
