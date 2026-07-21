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

const { generateAttention } = require("../index.ts");

const clientId = "client-attention";
const now = "2026-07-16T12:00:00.000Z";
const yesterday = "2026-07-15T12:00:00.000Z";

const assignments = [
  { providerId: "provider-bt", providerRole: "BehaviorTherapist", assignedToday: true },
  { providerId: "provider-slp", providerRole: "SpeechPathologist", assignedToday: true },
  { providerId: "provider-ot", providerRole: "OccupationalTherapist", assignedToday: true },
  { providerId: "provider-edu", providerRole: "Educator", assignedToday: true },
  { providerId: "provider-supervisor", providerRole: "Supervisor", assignedToday: true },
];

function event(overrides) {
  return {
    id: overrides.id,
    clientId,
    occurredAt: overrides.occurredAt ?? now,
    source: {
      sourceType: overrides.sourceType ?? "entry",
      providerId: overrides.providerId ?? "provider-bt",
      providerName: overrides.providerName ?? "Behavior Tech",
      providerRole: overrides.providerRole ?? "BehaviorTherapist",
      entryId: overrides.entryId ?? "entry-1",
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

function assertAttentionEvent(attentionEvent, expected) {
  assert.equal(attentionEvent.attentionType, expected.attentionType);
  assert.equal(attentionEvent.level, expected.level);
  assert.deepEqual(attentionEvent.clinicalEventIds, expected.clinicalEventIds);
  assert.equal(attentionEvent.source.providerId, expected.providerId);
  assert.equal(attentionEvent.audience.scope, expected.scope);
  assert.ok(attentionEvent.rationale.length > 0);
}

test("new reinforcer generates a medium attention event", () => {
  const clinicalEvent = event({
    id: "evt-reinforcer",
    category: "reinforcer",
    eventType: "reinforcer_discovered",
    title: "New Reinforcer",
    summary: "Preferred item was effective as a reinforcer.",
    tags: ["reinforcer"],
  });

  const result = generateAttention({ currentEvents: [clinicalEvent], providerAssignments: assignments });
  assert.equal(result.attentionEvents.length, 1);
  assertAttentionEvent(result.attentionEvents[0], {
    attentionType: "new_reinforcer",
    level: "medium",
    clinicalEventIds: ["evt-reinforcer"],
    providerId: "provider-bt",
    scope: "entire_team",
  });
});

test("poor sleep generates a caregiver context attention event for today's assigned providers", () => {
  const clinicalEvent = event({
    id: "evt-poor-sleep",
    category: "caregiver_context",
    eventType: "caregiver_sleep_context",
    title: "Sleep",
    summary: "Caregiver reported sleep: Poor.",
    providerId: "provider-caregiver",
    providerName: "Care Giver",
    providerRole: "Caregiver",
    details: { key: "sleep", value: "Poor" },
    tags: ["caregiver", "sleep"],
  });

  const result = generateAttention({ currentEvents: [clinicalEvent], providerAssignments: assignments });
  assert.equal(result.attentionEvents.length, 1);
  assertAttentionEvent(result.attentionEvents[0], {
    attentionType: "caregiver_context",
    level: "medium",
    clinicalEventIds: ["evt-poor-sleep"],
    providerId: "provider-caregiver",
    scope: "assigned_today",
  });
  assert.deepEqual(result.attentionEvents[0].audience.providerIds, assignments.map((item) => item.providerId));
});

test("mastered target generates a medium mastery attention event", () => {
  const clinicalEvent = event({
    id: "evt-mastered",
    category: "target_progress",
    eventType: "target_mastered",
    title: "Target mastered",
    summary: "Transition target was mastered.",
    target: {
      goalId: "goal-transition",
      target: "Transitioning",
      goal: "Transitions independently.",
      measurementProfile: "Independence",
    },
    details: { isMastered: true },
    tags: ["target_progress", "mastery"],
  });

  const result = generateAttention({ currentEvents: [clinicalEvent], providerAssignments: assignments });
  assert.equal(result.attentionEvents.length, 1);
  assertAttentionEvent(result.attentionEvents[0], {
    attentionType: "mastery",
    level: "medium",
    clinicalEventIds: ["evt-mastered"],
    providerId: "provider-bt",
    scope: "entire_team",
  });
});

test("increased prompting is detected by comparing current and historical prompt scores", () => {
  const previous = event({
    id: "evt-prompt-previous",
    occurredAt: yesterday,
    category: "target_progress",
    eventType: "behavior_therapy_target_progress",
    title: "Behavior Therapy Progress: Transitions",
    summary: "Minimal prompting was needed.",
    target: {
      goalId: "goal-prompt",
      target: "Transitions",
      goal: "Transition with less prompting.",
      measurementProfile: "PromptLevel",
    },
    measurement: { metricType: "Subjective", score: 3, label: "PromptLevel" },
    tags: ["behavior_therapy"],
  });
  const current = event({
    ...previous,
    id: "evt-prompt-current",
    occurredAt: now,
    summary: "Moderate prompting was needed.",
    measurement: { metricType: "Subjective", score: 2, label: "PromptLevel" },
  });

  const result = generateAttention({
    currentEvents: [current],
    historicalEvents: [previous],
    providerAssignments: assignments,
  });
  assert.equal(result.attentionEvents.length, 1);
  assertAttentionEvent(result.attentionEvents[0], {
    attentionType: "increased_support",
    level: "medium",
    clinicalEventIds: ["evt-prompt-current"],
    providerId: "provider-bt",
    scope: "role_based",
  });
  assert.equal(result.attentionEvents[0].metadata.priorScore, 3);
  assert.equal(result.attentionEvents[0].metadata.currentScore, 2);
});

test("ABC safety event generates a high attention event and remains traceable", () => {
  const clinicalEvent = event({
    id: "evt-abc-safety",
    category: "abc_observation",
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: "Verbal aggression occurred after peer interaction.",
    details: {
      antecedent: "Peer interaction",
      behavior: "Verbal aggression",
      consequence: "Redirected to task",
    },
    tags: ["abc", "behavior"],
  });

  const result = generateAttention({ currentEvents: [clinicalEvent], providerAssignments: assignments });
  assert.equal(result.attentionEvents.length, 1);
  assertAttentionEvent(result.attentionEvents[0], {
    attentionType: "safety_concern",
    level: "high",
    clinicalEventIds: ["evt-abc-safety"],
    providerId: "provider-bt",
    scope: "entire_team",
  });
});

test("new sensory trigger generates a medium sensory concern for role-based audience", () => {
  const clinicalEvent = event({
    id: "evt-sensory-new",
    category: "sensory_observation",
    eventType: "sensory_observation_documented",
    title: "Sensory Avoiding",
    summary: "Covered ears during loud classroom transition.",
    providerId: "provider-ot",
    providerName: "Occ Therapy",
    providerRole: "OccupationalTherapist",
    details: {
      category: "Sensory Avoiding",
      observation: "Covered ears during loud classroom transition.",
    },
    tags: ["occupational_therapy", "sensory"],
  });

  const result = generateAttention({ currentEvents: [clinicalEvent], historicalEvents: [], providerAssignments: assignments });
  assert.equal(result.attentionEvents.length, 1);
  assertAttentionEvent(result.attentionEvents[0], {
    attentionType: "sensory_concern",
    level: "medium",
    clinicalEventIds: ["evt-sensory-new"],
    providerId: "provider-ot",
    scope: "role_based",
  });
  assert.deepEqual(result.attentionEvents[0].audience.roles, [
    "OccupationalTherapist",
    "BehaviorTherapist",
    "Educator",
    "Supervisor",
  ]);
});

test("Team Focus generates a supervisor directive, not an attention event", () => {
  const clinicalEvent = event({
    id: "evt-team-focus",
    category: "team_focus",
    eventType: "team_focus_published",
    title: "Transition Independence",
    summary: "Reduce transition behaviors across school and therapy settings.",
    providerId: "provider-supervisor",
    providerName: "Clinical Lead",
    providerRole: "Supervisor",
    sourceType: "team_focus",
    tags: ["team_focus", "supervisor_direction"],
  });

  const result = generateAttention({ currentEvents: [clinicalEvent], providerAssignments: assignments });
  assert.equal(result.attentionEvents.length, 0);
  assert.equal(result.supervisorDirectives.length, 1);
  assert.equal(result.supervisorDirectives[0].directiveType, "team_focus");
  assert.equal(result.supervisorDirectives[0].level, "important");
  assert.deepEqual(result.supervisorDirectives[0].clinicalEventIds, ["evt-team-focus"]);
  assert.equal(result.supervisorDirectives[0].audience.scope, "entire_team");
});

test("routine target progress does not generate attention", () => {
  const clinicalEvent = event({
    id: "evt-routine",
    category: "target_progress",
    eventType: "academic_target_progress",
    title: "Academic Progress: Assignment Completion",
    summary: "Expected academic progress documented.",
    providerId: "provider-edu",
    providerName: "Ed Teacher",
    providerRole: "Educator",
    target: {
      goalId: "goal-academic",
      target: "Assignment Completion",
      goal: "Complete independent work.",
      measurementProfile: "Completion",
    },
    measurement: { metricType: "Subjective", score: 3, label: "Completion" },
    tags: ["educator", "academic"],
  });

  const result = generateAttention({ currentEvents: [clinicalEvent], providerAssignments: assignments });
  assert.equal(result.attentionEvents.length, 0);
  assert.equal(result.summary.highestLevel, "none");
});

test("attention summary ranks highest level and top events", () => {
  const safety = event({
    id: "evt-summary-safety",
    category: "abc_observation",
    eventType: "abc_observation_documented",
    title: "A-B-C Observation",
    summary: "Elopement occurred after transition demand.",
    details: {
      antecedent: "Transition demand",
      behavior: "Elopement",
      consequence: "Blocked exit and redirected.",
    },
    tags: ["abc", "safety"],
  });
  const sleep = event({
    id: "evt-summary-sleep",
    category: "caregiver_context",
    eventType: "caregiver_sleep_context",
    title: "Sleep",
    summary: "Caregiver reported sleep: Poor.",
    providerId: "provider-caregiver",
    providerName: "Care Giver",
    providerRole: "Caregiver",
    details: { key: "sleep", value: "Poor" },
    tags: ["caregiver", "sleep"],
  });

  const result = generateAttention({ currentEvents: [sleep, safety], providerAssignments: assignments });
  assert.equal(result.summary.clientId, clientId);
  assert.equal(result.summary.highestLevel, "high");
  assert.equal(result.summary.activeCount, 2);
  assert.equal(result.summary.topEvents[0].attentionType, "safety_concern");
});
