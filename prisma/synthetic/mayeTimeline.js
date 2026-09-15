/**
 * Baseline-relative synthetic timeline for Maye's signal-calibration case.
 *
 * High assistance, echolalia, pacing, and motor-planning needs are ordinary
 * features of this client's starting profile. They are source data, not alert
 * labels. Expected colors live in a separate review track.
 */

const DAY_MS = 86_400_000;

const ROLE = Object.freeze({
  BEHAVIOR_THERAPIST: "BehaviorTherapist",
  SPEECH_PATHOLOGIST: "SpeechPathologist",
  OCCUPATIONAL_THERAPIST: "OccupationalTherapist",
  EDUCATOR: "Educator",
  CAREGIVER: "Caregiver",
  SUPERVISOR: "Supervisor",
});

const PROFILE = Object.freeze({
  id: "maye-signal-lab-v1",
  client: {
    syntheticKey: "synthetic-client-maye-signal-lab-v1",
    firstName: "Maye",
    lastName: "Signal Lab",
    description:
      "Synthetic high-support-needs school case for baseline-relative signal calibration; support level alone is never an alert.",
  },
  dateRange: { start: "2026-02-02", end: "2026-03-27" },
  calibration: {
    amberTransitionLatencyMinutes: 35,
    amberRefusalFrequency: 3,
    personalBaselinePerformanceFloor: 0.38,
    bluePerformanceFloor: 0.7,
    blueTransitionLatencyMinutes: 10,
    blueRefusalFrequency: 1,
  },
  providers: Object.values(ROLE).map((role) => ({ role })),
});

const PHASES = Object.freeze([
  { id: "baseline_mapping", start: "2026-02-02", end: "2026-02-06" },
  { id: "placement_mismatch", start: "2026-02-09", end: "2026-02-20" },
  { id: "coordinated_plan", start: "2026-02-23", end: "2026-03-02" },
  { id: "routine_acquisition", start: "2026-03-03", end: "2026-03-13" },
  { id: "cross_setting_generalization", start: "2026-03-16", end: "2026-03-27" },
]);

const ANCHOR_EVENTS = Object.freeze([
  {
    id: "cross-provider-transition-review",
    date: "2026-02-12",
    expectedSignal: "amber",
    rationale: "Repeated 40–50 minute transitions and collapse/refusal exceeded Maye's mapped baseline across providers.",
  },
  {
    id: "critical-exit-safety-event",
    date: "2026-02-18",
    expectedSignal: "red",
    rationale: "An elopement beyond the secured activity area created a predefined critical safety condition.",
  },
  {
    id: "placement-support-request",
    date: "2026-02-20",
    expectedSignal: "amber",
    rationale: "The BT appropriately requested placement and schedule guidance; an active review is not itself a red failure.",
  },
  {
    id: "split-schedule-plan",
    date: "2026-02-23",
    expectedSignal: "amber",
    rationale: "A concrete plan exists, but early implementation still requires monitoring.",
  },
  {
    id: "first-cross-setting-success",
    date: "2026-03-05",
    expectedSignal: "blue",
    rationale: "Maye completed supported instruction and a short mainstream segment with a transition under ten minutes.",
  },
  {
    id: "novel-routine-regression",
    date: "2026-03-13",
    expectedSignal: "amber",
    rationale: "A novel schedule produced a bounded transition regression requiring review, without a critical safety event.",
  },
  {
    id: "generalized-routine",
    date: "2026-03-24",
    expectedSignal: "blue",
    rationale: "Improvement generalized across caregiver, BT, educator, and speech records rather than appearing on one isolated day.",
  },
]);

function parseDate(value) {
  return new Date(`${value}T12:00:00.000Z`);
}

function weekdaysBetween(start, end) {
  const dates = [];
  for (let cursor = parseDate(start); cursor <= parseDate(end); cursor = new Date(cursor.getTime() + DAY_MS)) {
    if (![0, 6].includes(cursor.getUTCDay())) dates.push(cursor.toISOString().slice(0, 10));
  }
  return dates;
}

function phaseForDate(date) {
  return PHASES.find((phase) => date >= phase.start && date <= phase.end);
}

function expectedSignalForDate(date) {
  if (date === "2026-02-18") return "red";
  if (
    (date >= "2026-02-09" && date <= "2026-03-02") ||
    date === "2026-03-13"
  ) return "amber";
  if (
    ["2026-03-05", "2026-03-06", "2026-03-09", "2026-03-17", "2026-03-19", "2026-03-20"].includes(date) ||
    date >= "2026-03-23"
  ) return "blue";
  return "neutral";
}

function conditionForDate(date) {
  return {
    neutral: "personal_baseline",
    amber: "transition_review",
    red: "critical_safety_event",
    blue: "sustained_positive_change",
  }[expectedSignalForDate(date)];
}

function item(target, goal, measurementProfile, metricType, value, observation, domain = "Adaptive") {
  return {
    target,
    goal,
    measurementProfile,
    metricType,
    domain,
    score: metricType === "Subjective" ? value : null,
    rawValue: metricType === "Subjective" ? null : value,
    observation,
  };
}

function transitionProfile(date) {
  const condition = conditionForDate(date);
  if (condition === "critical_safety_event") return { latency: 48, refusals: 4, participation: 1, communication: 1 };
  if (condition === "transition_review") return { latency: date === "2026-03-13" ? 38 : 42, refusals: 3, participation: 1, communication: 1 };
  if (condition === "sustained_positive_change") return { latency: 6, refusals: 0, participation: 4, communication: 3 };
  return { latency: 22, refusals: 1, participation: 1, communication: 1 };
}

function entryRecord({ date, role, kind = "SessionNote", note, items = [], contextData = null, abcObservations = [] }) {
  return {
    recordType: "entry",
    syntheticId: `maye-${date}-${role}-${kind}`.toLowerCase(),
    date: `${date}T17:00:00.000Z`,
    role,
    kind,
    visibility: "Shared",
    status: "COMPLETED",
    note,
    clinicalReflection: null,
    contextData,
    items,
    abcObservations,
  };
}

function btEntry(date) {
  const profile = transitionProfile(date);
  const condition = conditionForDate(date);
  const critical = condition === "critical_safety_event";
  const improving = condition === "sustained_positive_change";
  return entryRecord({
    date,
    role: ROLE.BEHAVIOR_THERAPIST,
    note: critical
      ? "During an unplanned doorway transition, Maye eloped beyond the secured area and entered the parking area before staff restored direct supervision and activated the safety response."
      : improving
        ? "Maye used the visual schedule, transitioned between the special-needs room and mainstream classroom, kept shoes on, and participated in both settings."
        : condition === "transition_review"
          ? "Maye paced, collapsed to the floor, and removed shoes during a prolonged transition. Staff paused for safety, offered a visual first-then cue, and continued the planned transition when she was ready."
          : "Maye required her established high level of prompting. Pacing and echolalia were present, while transition and participation remained within her mapped baseline.",
    items: [
      item("Transition Latency", "Moves between scheduled settings with the individualized transition plan.", "Latency", "Duration", profile.latency, `${profile.latency} minutes from transition cue to arrival.`),
      item("Transition Refusal", "Reduces collapse, footwear removal, and prolonged refusal during scheduled transitions.", "Frequency", "Frequency", profile.refusals, `${profile.refusals} observable refusal responses; intent was not inferred.`, "Behavior"),
      item("Manding", "Uses speech, gesture, or a visual to request a break or preferred item.", "PromptLevel", "Subjective", profile.communication, improving ? "Requested puzzle or break with a visual or short phrase." : "Required modeled and gestural prompting; echolalic language was not treated as noncompliance.", "Communication"),
      item("Classroom Participation", "Participates in the planned instructional segment with individualized support.", "SupportLevel", "Subjective", profile.participation, improving ? "Completed both planned setting segments." : "Participation matched the current high-support baseline."),
    ],
    abcObservations: condition === "transition_review" || critical ? [{
      antecedent: "A transition from a preferred or low-stimulation area to the scheduled classroom was presented.",
      behavior: critical ? "Eloped beyond the secured area and entered the parking area." : "Paced, collapsed, removed shoes, and delayed movement for more than 35 minutes.",
      consequence: "Staff maintained safety, reduced verbal load, used the visual sequence, and documented latency before re-presenting the transition.",
    }] : [],
  });
}

function educatorEntry(date) {
  const profile = transitionProfile(date);
  const improving = conditionForDate(date) === "sustained_positive_change";
  return entryRecord({
    date,
    role: ROLE.EDUCATOR,
    note: improving
      ? "The split schedule allowed successful supported instruction followed by a brief mainstream activity with peers."
      : "Full support, reduced task length, and a puzzle reinforcer were available; high assistance remained expected at baseline.",
    items: [
      item("Following Classroom Routine", "Completes the individualized classroom sequence with planned support.", "Independence", "Subjective", profile.participation, improving ? "Followed both setting routines with visual support." : "Required full support without an acute safety concern."),
      item("Attention", "Participates in a short group or table activity.", "Independence", "Subjective", improving ? 3 : 2, improving ? "Participated for the planned interval." : "Brief attention occurred with close adult support."),
    ],
  });
}

function speechEntry(date) {
  const improving = conditionForDate(date) === "sustained_positive_change";
  return entryRecord({
    date,
    role: ROLE.SPEECH_PATHOLOGIST,
    kind: "SpeechProgress",
    note: improving
      ? "Maye used a functional break request in both therapy and classroom carryover; echolalia remained part of her communication profile."
      : "Echolalia, pacing, and maximum cueing remained consistent with the established communication baseline.",
    items: [
      item("Requesting", "Uses an available communication mode to request a break or preferred activity.", "CueingLevel", "Subjective", improving ? 3 : 1, improving ? "Used a visual plus a short phrase across two settings." : "Required maximum cueing.", "Communication"),
      item("Listener Responding", "Responds to a familiar one-step direction with available supports.", "CueingLevel", "Subjective", improving ? 3 : 1, improving ? "Responded with reduced cueing." : "Maximum cueing remained baseline.", "Communication"),
    ],
  });
}

function otEntry(date) {
  const improving = conditionForDate(date) === "sustained_positive_change";
  return entryRecord({
    date,
    role: ROLE.OCCUPATIONAL_THERAPIST,
    note: "Motor-planning and proprioceptive support needs were monitored as a separate clinical domain and did not independently control the badge color.",
    items: [
      item("Bilateral Coordination", "Climbs steps using the safest available gait pattern with decreasing assistance.", "AssistanceLevel", "Subjective", improving ? 2 : 1, improving ? "Completed several steps with moderate assistance." : "Step-to gait and full assistance remained baseline.", "Other"),
      item("Zippering", "Completes successive parts of zippering with decreasing assistance.", "AssistanceLevel", "Subjective", improving ? 3 : 1, improving ? "Pulled zipper after setup and began aligning the base." : "Pulled zipper after adult hookup.", "Adaptive"),
    ],
  });
}

function caregiverEntry(date) {
  const improving = conditionForDate(date) === "sustained_positive_change";
  const contextData = {
    kind: "morning",
    entries: [
      { key: "sleep", label: "Sleep", value: improving ? "Good" : "Variable" },
      { key: "medication", label: "Medication", value: "Given" },
      { key: "schoolTransition", label: "School Transition", value: improving ? "Smooth with visual" : "Needed support" },
    ],
    comment: improving ? "Caregiver reported a calmer school transition and reviewed the positive note." : "Caregiver remained engaged and reported context without assigning cause.",
  };
  return entryRecord({
    date,
    role: ROLE.CAREGIVER,
    kind: "MorningContext",
    note: contextData.entries.map((entry) => `${entry.label}: ${entry.value}`).concat(`Comment: ${contextData.comment}`).join("\n"),
    contextData,
  });
}

function sourceRecordsForDate(date) {
  const weekday = parseDate(date).getUTCDay();
  const records = [btEntry(date)];
  if ([1, 3, 5].includes(weekday)) records.push(educatorEntry(date));
  if (weekday === 2) records.push(speechEntry(date));
  if (weekday === 4) records.push(otEntry(date));
  if ([1, 4].includes(weekday)) records.push(caregiverEntry(date));
  if (["2026-02-20", "2026-02-23", "2026-03-06", "2026-03-24"].includes(date)) {
    records.push(entryRecord({
      date,
      role: ROLE.SUPERVISOR,
      kind: "SupervisorObservation",
      note: date >= "2026-02-23"
        ? "The team reviewed split-schedule implementation, transition latency, safe prompting, functional communication, and participation in both settings."
        : "Cross-provider records support a placement and transition-plan review; high assistance alone is not an escalation.",
    }));
  }
  return records;
}

function caseSupportRecords() {
  return [
    {
      recordType: "caseSupportRequest",
      syntheticId: "maye-case-request-2026-02-20",
      date: "2026-02-20T17:00:00.000Z",
      requesterRole: ROLE.BEHAVIOR_THERAPIST,
      recipientRole: ROLE.SUPERVISOR,
      concern: "Maye consistently seeks the quieter special-needs room and has prolonged transitions into the full mainstream schedule.",
      requestedSupport: "Review placement fit and trial a documented split schedule with preparation for short mainstream segments.",
      status: "CASE_OPENED",
    },
    {
      recordType: "caseSupportCoordination",
      syntheticId: "maye-coordination-2026-02-23",
      date: "2026-02-23T17:00:00.000Z",
      authorRole: ROLE.SUPERVISOR,
      path: "EXTERNAL",
      status: "MONITORING",
      communicationMethod: "IN_PERSON",
      actionTaken: "Supervisor and school defined a split schedule, visual transition sequence, safe prompting boundaries, and data-review cadence.",
      requestOrDecision: "Instruction begins in the lower-stimulation setting with planned, gradually lengthened mainstream segments.",
      nextStep: "Monitor transition latency, refusals, functional requests, and participation across settings for four weeks.",
    },
  ];
}

function goalKey(role, target) {
  return `${role}:${target.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function attachGoalKeys(records) {
  return records.map((record) => record.recordType !== "entry" ? record : ({
    ...record,
    items: record.items.map((entryItem) => ({ ...entryItem, goalKey: goalKey(record.role, entryItem.target) })),
  }));
}

function buildGoalDefinitions(records) {
  const goals = new Map();
  for (const record of records.filter((candidate) => candidate.recordType === "entry")) {
    for (const entryItem of record.items) {
      if (!goals.has(entryItem.goalKey)) goals.set(entryItem.goalKey, {
        syntheticKey: entryItem.goalKey,
        providerRole: record.role,
        target: entryItem.target,
        goal: entryItem.goal,
        metricType: entryItem.metricType,
        domain: entryItem.domain,
        measurementProfile: entryItem.measurementProfile,
        weight: 1,
        isActive: true,
        isMastered: false,
      });
    }
  }
  return [...goals.values()].sort((a, b) => a.syntheticKey.localeCompare(b.syntheticKey));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = item[key];
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function buildMayeTimeline() {
  const evaluationDates = weekdaysBetween(PROFILE.dateRange.start, PROFILE.dateRange.end);
  const entries = attachGoalKeys(evaluationDates.flatMap(sourceRecordsForDate));
  const sourceRecords = [...entries, ...caseSupportRecords()].sort((a, b) => a.date.localeCompare(b.date));
  const expectedSignals = evaluationDates.map((date) => ({
    date,
    expectedSignal: expectedSignalForDate(date),
    scenarioCondition: conditionForDate(date),
    phaseId: phaseForDate(date).id,
    expectedReason: ANCHOR_EVENTS.find((anchor) => anchor.date === date)?.id ?? null,
  }));
  const dataset = {
    schemaVersion: 1,
    fixtureId: PROFILE.id,
    profile: PROFILE,
    phases: PHASES,
    goalDefinitions: buildGoalDefinitions(entries),
    sourceRecords,
    expectedSignals,
  };
  return {
    ...dataset,
    summary: {
      fixtureId: dataset.fixtureId,
      dateRange: PROFILE.dateRange,
      evaluableDays: evaluationDates.length,
      sourceRecordCount: sourceRecords.length,
      entryCount: entries.length,
      goalDefinitionCount: dataset.goalDefinitions.length,
      entryCountsByRole: countBy(entries, "role"),
      expectedSignals: countBy(expectedSignals, "expectedSignal"),
      anchorEvents: ANCHOR_EVENTS,
    },
  };
}

module.exports = {
  ANCHOR_EVENTS,
  PHASES,
  PROFILE,
  ROLE,
  buildMayeTimeline,
  expectedSignalForDate,
  weekdaysBetween,
};
