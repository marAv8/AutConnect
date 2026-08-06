/**
 * Third calibration case: a stable, nonspeaking young child whose program is
 * dominated by DTT and functional communication. Prompted mastery is common;
 * blue is reserved for newly independent communication or generalization.
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
  id: "fct-signal-lab-v1",
  client: {
    syntheticKey: "synthetic-client-fct-signal-lab-v1",
    firstName: "FCT",
    lastName: "Signal Lab",
    description:
      "Synthetic nonspeaking high-support-needs DTT case for functional-communication signal calibration.",
  },
  dateRange: { start: "2026-02-02", end: "2026-03-27" },
  calibration: {
    blueRequiresIndependenceMilestone: true,
    amberRefusalFrequency: 4,
    personalBaselinePerformanceFloor: 0.45,
  },
  providers: Object.values(ROLE).map((role) => ({ role })),
});

const MILESTONES = Object.freeze([
  { date: "2026-02-13", target: "Pointing to Request", id: "first-independent-point" },
  { date: "2026-02-25", target: "Picture Selection", id: "independent-picture-selection" },
  { date: "2026-03-06", target: "Communication System Access", id: "independent-system-reach" },
  { date: "2026-03-17", target: "Requesting a Break", id: "independent-break-request" },
  { date: "2026-03-19", target: "Caregiver Communication", id: "home-generalization" },
  { date: "2026-03-24", target: "Novel Partner Request", id: "novel-partner-generalization" },
]);

const ANCHOR_EVENTS = Object.freeze([
  {
    id: "routine-dtt-mastery-neutral",
    date: "2026-02-10",
    expectedSignal: "neutral",
    rationale: "Prompted DTT acquisition is meaningful clinical data but not a new independent communication milestone.",
  },
  ...MILESTONES.map((milestone) => ({
    ...milestone,
    expectedSignal: "blue",
    rationale: "The communication response was newly independent after repeated supported opportunities.",
  })),
  {
    id: "communication-material-unavailable",
    date: "2026-02-18",
    expectedSignal: "amber",
    rationale: "Loss of access to the planned communication system caused a marked, reviewable deviation from baseline.",
  },
  {
    id: "marked-state-change",
    date: "2026-03-12",
    expectedSignal: "amber",
    rationale: "A sudden cross-activity reduction in engagement exceeded the stable baseline and required contextual review.",
  },
  {
    id: "synthetic-medical-safety-stress-test",
    date: "2026-03-23",
    expectedSignal: "red",
    rationale: "Artificial test-only critical medical event; not part of the narrated history.",
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

function expectedSignalForDate(date) {
  if (date === "2026-03-23") return "red";
  if (["2026-02-18", "2026-03-12"].includes(date)) return "amber";
  if (MILESTONES.some((milestone) => milestone.date === date)) return "blue";
  return "neutral";
}

function item(target, goal, profile, metricType, value, observation, domain = "Communication") {
  return {
    target,
    goal,
    measurementProfile: profile,
    metricType,
    domain,
    score: metricType === "Subjective" ? value : null,
    rawValue: metricType === "Subjective" ? null : value,
    observation,
  };
}

function acquiredScore(date, target) {
  const milestone = MILESTONES.find((candidate) => candidate.target === target);
  return milestone && date >= milestone.date ? 4 : 2;
}

function entryRecord({ date, role, kind = "SessionNote", note, items = [], contextData = null, abcObservations = [] }) {
  return {
    recordType: "entry",
    syntheticId: `fct-${date}-${role}-${kind}`.toLowerCase(),
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
  const amber = ["2026-02-18", "2026-03-12"].includes(date);
  const red = date === "2026-03-23";
  const milestone = MILESTONES.find((candidate) => candidate.date === date);
  const refusalCount = amber ? 4 : red ? 2 : 0;
  return entryRecord({
    date,
    role: ROLE.BEHAVIOR_THERAPIST,
    note: red
      ? "Synthetic safety stress test only: a sudden medical event required emergency services and the session ended under the emergency plan."
      : date === "2026-02-18"
        ? "The planned picture communication materials were unavailable across activities. The client could not access the established response mode and showed an unusual sustained reduction in participation."
        : date === "2026-03-12"
          ? "After caregiver-reported absent sleep, engagement dropped markedly across familiar DTT tasks. Staff reduced demands, monitored observable state, and requested contextual review without inferring a cause."
          : milestone
            ? `New functional-communication milestone observed: ${milestone.target} occurred independently after repeated supported opportunities.`
            : "The client was calm and participated in familiar DTT. Full assistance with daily living and prompted communication remained within the individualized baseline.",
    items: [
      item("Pointing to Request", "Points toward a desired item or activity as a functional request.", "PromptLevel", "Subjective", acquiredScore(date, "Pointing to Request"), date >= "2026-02-13" ? "Pointing remained available independently." : "Physical or gestural prompting was used."),
      item("Picture Selection", "Selects the matching picture to request a preferred item.", "PromptLevel", "Subjective", acquiredScore(date, "Picture Selection"), date >= "2026-02-25" ? "Selected the picture independently." : "Completed with systematic prompting."),
      item("Communication System Access", "Independently reaches for the functional communication system before requesting.", "PromptLevel", "Subjective", acquiredScore(date, "Communication System Access"), date >= "2026-03-06" ? "Reached for the system independently." : "The system was presented and prompted."),
      item("Requesting a Break", "Uses the communication system to request a break.", "PromptLevel", "Subjective", acquiredScore(date, "Requesting a Break"), date >= "2026-03-17" ? "Requested a break independently." : "Break request was prompted."),
      item("Matching", "Completes familiar identical matching trials.", "Accuracy", "Subjective", 4, "High DTT performance was routine and did not independently create a blue signal.", "SkillAcquisition"),
      item("Transition Refusal", "Participates in familiar session transitions with individualized support.", "Frequency", "Frequency", refusalCount, `${refusalCount} marked refusals observed.`, "Behavior"),
    ],
  });
}

function educatorEntry(date) {
  return entryRecord({
    date,
    role: ROLE.EDUCATOR,
    note: "The specialized classroom and visual sequence remained appropriate. Mainstream placement was not used as a success criterion.",
    items: [
      item("Visual Schedule", "Follows the next visual step with decreasing support.", "PromptLevel", "Subjective", date >= "2026-03-06" ? 3 : 2, "Completed the individualized classroom sequence.", "Adaptive"),
      item("DTT Participation", "Participates in brief discrete-trial learning blocks with planned reinforcement.", "Participation", "Subjective", 4, "Stable participation and frequent acquisition remained the client's neutral baseline.", "SkillAcquisition"),
    ],
  });
}

function speechEntry(date) {
  const score = acquiredScore(date, "Novel Partner Request");
  return entryRecord({
    date,
    role: ROLE.SPEECH_PATHOLOGIST,
    kind: "SpeechProgress",
    note: date === "2026-03-24"
      ? "A newly independent request generalized to an unfamiliar communication partner."
      : "Functional communication was practiced with aided language input and sufficient response time; speech was not required.",
    items: [
      item("Novel Partner Request", "Uses the functional communication system with a less-familiar partner.", "CueingLevel", "Subjective", score, score === 4 ? "Independent with a novel partner." : "Required cueing with a less-familiar partner."),
    ],
  });
}

function caregiverEntry(date) {
  const score = acquiredScore(date, "Caregiver Communication");
  const contextData = {
    kind: "evening",
    entries: [
      { key: "sleep", label: "Sleep", value: date === "2026-03-12" ? "Did not sleep" : "Usual" },
      { key: "homeRoutine", label: "Home Routine", value: "Stable with full assistance" },
    ],
    comment: score === 4 ? "Independently brought the communication system to the caregiver and selected a request." : "Caregiver practiced the same visual communication sequence used at school.",
  };
  return entryRecord({
    date,
    role: ROLE.CAREGIVER,
    kind: "EveningContext",
    note: contextData.entries.map((entry) => `${entry.label}: ${entry.value}`).concat(`Comment: ${contextData.comment}`).join("\n"),
    contextData,
    items: [
      item("Caregiver Communication", "Initiates a functional request with the caregiver using the available system.", "PromptLevel", "Subjective", score, score === 4 ? "Independent communication generalized at home." : "Caregiver presented and prompted the system."),
    ],
  });
}

function otEntry(date) {
  return entryRecord({
    date,
    role: ROLE.OCCUPATIONAL_THERAPIST,
    note: "Physical disability and full self-care assistance remained stable baseline factors and were not interpreted as behavioral escalation.",
    items: [
      item("Shoe Dressing", "Participates in the shoe-dressing sequence with available physical support.", "AssistanceLevel", "Subjective", 1, "Full assistance remained expected.", "Adaptive"),
      item("Toileting Participation", "Participates in the scheduled toileting routine with available support.", "AssistanceLevel", "Subjective", 1, "Full assistance remained expected.", "Adaptive"),
    ],
  });
}

function supervisorEntry(date) {
  return entryRecord({
    date,
    role: ROLE.SUPERVISOR,
    kind: "SupervisorObservation",
    note: "The team reviewed independent functional communication, generalization, communication-system access, and deviations from the client's stable baseline. DTT mastery alone was not treated as a badge event.",
  });
}

function recordsForDate(date) {
  const weekday = parseDate(date).getUTCDay();
  const records = [btEntry(date)];
  if ([1, 3, 5].includes(weekday)) records.push(educatorEntry(date));
  if (weekday === 2) records.push(speechEntry(date));
  if (weekday === 4) records.push(otEntry(date));
  if ([1, 4].includes(weekday)) records.push(caregiverEntry(date));
  if (["2026-02-13", "2026-02-18", "2026-03-06", "2026-03-23", "2026-03-24"].includes(date)) records.push(supervisorEntry(date));
  return records;
}

function goalKey(role, target) {
  return `${role}:${target.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function attachGoalKeys(records) {
  return records.map((record) => ({
    ...record,
    items: record.items.map((entryItem) => ({ ...entryItem, goalKey: goalKey(record.role, entryItem.target) })),
  }));
}

function goalDefinitions(records) {
  const goals = new Map();
  for (const record of records) for (const entryItem of record.items) {
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
  return [...goals.values()].sort((a, b) => a.syntheticKey.localeCompare(b.syntheticKey));
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    counts[item[key]] = (counts[item[key]] ?? 0) + 1;
    return counts;
  }, {});
}

function buildFctTimeline() {
  const dates = weekdaysBetween(PROFILE.dateRange.start, PROFILE.dateRange.end);
  const sourceRecords = attachGoalKeys(dates.flatMap(recordsForDate));
  const expectedSignals = dates.map((date) => ({
    date,
    expectedSignal: expectedSignalForDate(date),
    expectedReason: ANCHOR_EVENTS.find((anchor) => anchor.date === date)?.id ?? null,
  }));
  const dataset = {
    schemaVersion: 1,
    fixtureId: PROFILE.id,
    profile: PROFILE,
    goalDefinitions: goalDefinitions(sourceRecords),
    sourceRecords,
    expectedSignals,
  };
  return {
    ...dataset,
    summary: {
      fixtureId: dataset.fixtureId,
      dateRange: PROFILE.dateRange,
      evaluableDays: dates.length,
      sourceRecordCount: sourceRecords.length,
      goalDefinitionCount: dataset.goalDefinitions.length,
      entryCountsByRole: countBy(sourceRecords, "role"),
      expectedSignals: countBy(expectedSignals, "expectedSignal"),
      anchorEvents: ANCHOR_EVENTS,
    },
  };
}

module.exports = { ANCHOR_EVENTS, MILESTONES, PROFILE, ROLE, buildFctTimeline, expectedSignalForDate, weekdaysBetween };
