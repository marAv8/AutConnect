/**
 * Pure, deterministic synthetic timeline for SuDo's signal-calibration case.
 *
 * This module never connects to Prisma and never writes to the database. It
 * produces two intentionally separate tracks:
 *   1. sourceRecords: what providers would have documented over time; and
 *   2. expectedSignals: the human-reviewed result used to evaluate a signal engine.
 *
 * Keeping those tracks separate prevents the expected badge color from being
 * embedded in the clinical source data the engine is supposed to interpret.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const SIGNAL = Object.freeze({
  NEUTRAL: "neutral",
  BLUE: "blue",
  AMBER: "amber",
  RED: "red",
});

const ROLE = Object.freeze({
  BEHAVIOR_THERAPIST: "BehaviorTherapist",
  SPEECH_PATHOLOGIST: "SpeechPathologist",
  OCCUPATIONAL_THERAPIST: "OccupationalTherapist",
  EDUCATOR: "Educator",
  CAREGIVER: "Caregiver",
  SUPERVISOR: "Supervisor",
});

const PROFILE = Object.freeze({
  id: "sudo-signal-lab-v1",
  client: {
    syntheticKey: "synthetic-client-sudo-signal-lab",
    firstName: "SuDo",
    lastName: "Signal Lab",
    description:
      "Synthetic multilingual school-age case used only for signal calibration; multilingualism is context, not a diagnosis or deficit.",
  },
  dateRange: {
    start: "2025-01-13",
    end: "2025-10-31",
  },
  providers: [
    { role: ROLE.BEHAVIOR_THERAPIST, name: "Synthetic BT" },
    { role: ROLE.SPEECH_PATHOLOGIST, name: "Synthetic SLP" },
    { role: ROLE.OCCUPATIONAL_THERAPIST, name: "Synthetic OT" },
    { role: ROLE.EDUCATOR, name: "Synthetic Educator" },
    { role: ROLE.CAREGIVER, name: "Synthetic Caregiver" },
    { role: ROLE.SUPERVISOR, name: "Synthetic Supervisor" },
  ],
});

const PHASES = Object.freeze([
  {
    id: "provider_transition",
    start: "2025-01-13",
    end: "2025-02-07",
    label: "New BT transition within a familiar school team",
  },
  {
    id: "familiar_routine_stabilization",
    start: "2025-02-10",
    end: "2025-05-30",
    label: "Familiar routines, behavior reduction, and communication support",
  },
  {
    id: "summer_stability",
    start: "2025-06-02",
    end: "2025-08-15",
    label: "Lower-demand summer program with effective one-to-one structure",
  },
  {
    id: "new_classroom_baseline",
    start: "2025-09-08",
    end: "2025-09-12",
    label: "New classroom begins with limited demands",
  },
  {
    id: "environmental_unpredictability",
    start: "2025-09-15",
    end: "2025-09-26",
    label: "Inconsistent play periods, warnings, routines, and visual supports",
  },
  {
    id: "generalization_and_coverage_strain",
    start: "2025-09-29",
    end: "2025-10-03",
    label: "Speech and inclusion demands expose weak generalization while BT coverage is diluted",
  },
  {
    id: "coordination_breakdown",
    start: "2025-10-06",
    end: "2025-10-17",
    label: "Sustained service-coordination failure and formal case escalation",
  },
  {
    id: "coordinated_response",
    start: "2025-10-20",
    end: "2025-10-31",
    label: "Supervisor-led plan, role clarification, implementation, and monitoring",
  },
]);

const SEPTEMBER_OCTOBER_SIGNAL_WEEKS = Object.freeze([
  ["neutral", "neutral", "amber", "neutral", "amber"],
  ["amber", "amber", "amber", "neutral", "amber"],
  ["amber", "amber", "amber", "amber", "neutral"],
  ["amber", "amber", "amber", "amber", "red"],
  ["red", "red", "red", "red", "red"],
  ["red", "red", "red", "red", "red"],
  ["red", "amber", "amber", "amber", "amber"],
  ["amber", "amber", "neutral", "neutral", "neutral"],
]);

const ANCHOR_EVENTS = Object.freeze([
  {
    id: "special-olympics-rotation",
    date: "2025-08-14",
    expectedSignal: SIGNAL.AMBER,
    title: "Novel multi-activity rotation and communication repair",
    rationale:
      "A prolonged, setting-specific deviation from baseline required additional support, but it was bounded and did not yet represent a sustained coordination failure.",
  },
  {
    id: "coverage-strain-documented",
    date: "2025-09-30",
    expectedSignal: SIGNAL.AMBER,
    title: "Assigned BT coverage repeatedly interrupted",
    rationale:
      "Client access to planned support was affected and required immediate review; red begins when the sustained concern is formally escalated without a coordinated plan.",
  },
  {
    id: "case-support-requested",
    date: "2025-10-03",
    expectedSignal: SIGNAL.RED,
    title: "Formal supervisor support requested",
    rationale:
      "The concern persisted across settings and providers and could no longer be addressed as an isolated client event.",
  },
  {
    id: "case-acknowledged",
    date: "2025-10-06",
    expectedSignal: SIGNAL.RED,
    title: "Supervisor acknowledges and opens coordination case",
    rationale:
      "Acknowledgment begins the response but does not erase the unresolved service-delivery condition.",
  },
  {
    id: "coordinated-plan-agreed",
    date: "2025-10-21",
    expectedSignal: SIGNAL.AMBER,
    title: "School and agency roles and schedule clarified",
    rationale:
      "The red condition can step down only after a concrete plan exists; monitoring remains necessary while implementation is new.",
  },
  {
    id: "implementation-monitoring",
    date: "2025-10-27",
    expectedSignal: SIGNAL.AMBER,
    title: "Visual schedule, transition warnings, and coverage plan monitored",
    rationale:
      "Early implementation evidence supports improvement, but sustained stability has not yet been demonstrated long enough for blue.",
  },
]);

function parseDate(value) {
  return new Date(`${value}T12:00:00.000Z`);
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function weekdaysBetween(start, end) {
  const dates = [];
  for (
    let cursor = parseDate(start);
    cursor.getTime() <= parseDate(end).getTime();
    cursor = new Date(cursor.getTime() + DAY_MS)
  ) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(isoDay(cursor));
  }
  return dates;
}

function phaseForDate(date) {
  return (
    PHASES.find((phase) => date >= phase.start && date <= phase.end) ?? {
      id: "scheduled_break",
      label: "No synthetic school-session records scheduled",
    }
  );
}

function hash(text) {
  let value = 2166136261;
  for (const character of text) {
    value ^= character.charCodeAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function variation(key, min, max) {
  return min + (hash(key) % (max - min + 1));
}

function scenarioConditionForDate(date, evaluableIndex) {
  if (date >= "2025-09-08" && date <= "2025-10-31") {
    const index = weekdaysBetween("2025-09-08", date).length - 1;
    const signal = SEPTEMBER_OCTOBER_SIGNAL_WEEKS[Math.floor(index / 5)][index % 5];
    return {
      neutral: "routine_baseline",
      amber: "review_condition",
      red: "coordination_failure",
    }[signal];
  }

  // The Jan-Aug case narrative expects approximately 50% routine baseline,
  // 30% review conditions, and 20% sustained positive evidence. The condition
  // affects generated measurements and is translated to a color only in the
  // separate evaluation track below.
  const pattern = [
    "routine_baseline",
    "routine_baseline",
    "review_condition",
    "routine_baseline",
    "sustained_positive_evidence",
    "review_condition",
    "routine_baseline",
    "sustained_positive_evidence",
    "review_condition",
    "routine_baseline",
  ];
  if (date === "2025-08-14") return "review_condition";
  return pattern[evaluableIndex % pattern.length];
}

function expectedSignalForDate(date, evaluableIndex) {
  const condition = scenarioConditionForDate(date, evaluableIndex);
  return {
    routine_baseline: SIGNAL.NEUTRAL,
    sustained_positive_evidence: SIGNAL.BLUE,
    review_condition: SIGNAL.AMBER,
    coordination_failure: SIGNAL.RED,
  }[condition];
}

function scoreProfile(date, phaseId, condition) {
  const noise = variation(date, 0, 1);
  let profile;
  switch (phaseId) {
    case "provider_transition":
      profile = { waiting: 1 + noise, transitions: 2, communication: 1 + noise, participation: 2, incidents: 2 - noise };
      break;
    case "familiar_routine_stabilization":
      profile = { waiting: 2 + noise, transitions: 3, communication: 2 + noise, participation: 3, incidents: 1 - noise };
      break;
    case "summer_stability":
      profile = { waiting: 2 + noise, transitions: 3 + noise, communication: 2 + noise, participation: 3, incidents: noise };
      break;
    case "new_classroom_baseline":
      profile = { waiting: 2, transitions: 2, communication: 2, participation: 2, incidents: 1 };
      break;
    case "environmental_unpredictability":
      profile = { waiting: 1, transitions: 1 + noise, communication: 1 + noise, participation: 1 + noise, incidents: 2 + noise };
      break;
    case "generalization_and_coverage_strain":
      profile = { waiting: 1, transitions: 1, communication: 1, participation: 1, incidents: 3 + noise };
      break;
    case "coordination_breakdown":
      profile = { waiting: 1, transitions: 1, communication: 1, participation: 1, incidents: 3 + noise };
      break;
    case "coordinated_response":
      profile = { waiting: 1 + noise, transitions: 2 + noise, communication: 1 + noise, participation: 2, incidents: 2 - noise };
      break;
    default:
      profile = { waiting: 2, transitions: 2, communication: 2, participation: 2, incidents: 1 };
  }

  if (condition === "sustained_positive_evidence") {
    return {
      waiting: Math.min(4, profile.waiting + 1),
      transitions: Math.min(4, profile.transitions + 1),
      communication: Math.min(4, profile.communication + 1),
      participation: Math.min(4, profile.participation + 1),
      incidents: Math.max(0, profile.incidents - 1),
    };
  }
  if (condition === "review_condition") {
    return {
      waiting: Math.max(1, profile.waiting - 1),
      transitions: Math.max(1, profile.transitions - 1),
      communication: Math.max(1, profile.communication - 1),
      participation: Math.max(1, profile.participation - 1),
      incidents: profile.incidents + 1,
    };
  }
  if (condition === "coordination_failure") {
    return {
      waiting: 1,
      transitions: 1,
      communication: 1,
      participation: 1,
      incidents: Math.max(3, profile.incidents),
    };
  }
  return profile;
}

function item(target, goal, measurementProfile, value, observation, options = {}) {
  return {
    target,
    goal,
    measurementProfile,
    metricType: options.metricType ?? "Subjective",
    domain: options.domain ?? "SkillAcquisition",
    score: options.metricType === "Frequency" ? null : value,
    rawValue: options.metricType === "Frequency" ? value : null,
    observation,
  };
}

function btItems(date, phaseId, condition) {
  const score = scoreProfile(date, phaseId, condition);
  return [
    item(
      "Waiting",
      "Waits for a turn during group activities using the planned support.",
      "PromptLevel",
      score.waiting,
      score.waiting <= 1
        ? "Required maximum prompting after a wait instruction; moved toward the sensory area and returned with co-regulation."
        : "Waited after verbal or visual support and accessed the activity when the turn became available.",
      { domain: "Adaptive" }
    ),
    item(
      "Transitions",
      "Transitions between scheduled activities with decreasing adult support.",
      "PromptLevel",
      score.transitions,
      phaseId === "summer_stability"
        ? "Transitioned within the familiar routine with minimal support."
        : "Transition success varied with predictability, wait demands, and access to a preferred activity.",
      { domain: "Adaptive" }
    ),
    item(
      "Elopement Reduction",
      "Remains within the assigned activity area and uses a functional request before leaving.",
      "Frequency",
      score.incidents,
      "Count reflects observable departures from the assigned area; intent was not inferred.",
      { metricType: "Frequency", domain: "Behavior" }
    ),
    item(
      "Expressive Labeling",
      "Communicates frustration or a basic need using speech, gesture, writing, or another available mode.",
      "PromptLevel",
      score.communication,
      "Staff labeled the emotion or need and accepted multimodal communication while supporting an English response.",
      { domain: "Communication" }
    ),
  ];
}

function educatorItems(date, phaseId, condition) {
  const score = scoreProfile(date, phaseId, condition);
  const strained = [
    "environmental_unpredictability",
    "generalization_and_coverage_strain",
    "coordination_breakdown",
  ].includes(phaseId);
  return [
    item(
      "Academic Engagement",
      "Participates in the assigned lesson while following the classroom group routine.",
      "Participation",
      score.participation,
      strained
        ? "Completed academic work when steps were made explicit, but group participation decreased when timing and staff direction changed."
        : "Demonstrated strong academic skills and completed the assigned material with the scheduled support.",
      { domain: "SkillAcquisition" }
    ),
    item(
      "Group Participation",
      "Participates with peers while waiting, responding to group cues, and respecting personal space.",
      "SupportLevel",
      Math.min(score.waiting, score.participation),
      "Observed turn-taking, group positioning, interruptions, and response to peer boundaries without judging intent.",
      { domain: "Adaptive" }
    ),
    item(
      "Following Directions",
      "Completes classroom directions after the whole-group instruction.",
      "Independence",
      score.transitions,
      "Listening and written work were separated into smaller steps when simultaneous demands reduced participation.",
      { domain: "SkillAcquisition" }
    ),
  ];
}

function speechItems(date, phaseId, condition) {
  const score = scoreProfile(date, phaseId, condition);
  return [
    item(
      "Requesting",
      "Communicates a need or requests access before taking an item or leaving the activity.",
      "CueingLevel",
      score.communication,
      "Speech, gesture, writing, visual support, and familiar-language clarification were accepted as communication while intelligibility was supported.",
      { domain: "Communication" }
    ),
    item(
      "Conversation Skills",
      "Responds to a peer and completes at least three reciprocal turns with available supports.",
      "Accuracy",
      score.communication,
      "Intelligibility and wait demands affected reciprocal interaction more than comprehension of the topic.",
      { domain: "Communication" }
    ),
    item(
      "Articulation",
      "Produces an intelligible sentence at an appropriate speaking rate using visual or modeled support as needed.",
      "Accuracy",
      Math.min(3, score.communication + 1),
      "Reading and written language remained stronger than spontaneous speech intelligibility.",
      { domain: "Communication" }
    ),
  ];
}

function otItems(date, phaseId) {
  const strong = phaseId === "provider_transition" ? 3 : 4;
  return [
    item(
      "Handwriting",
      "Completes the assigned handwriting task with decreasing assistance.",
      "AssistanceLevel",
      strong,
      "Completed the written task with strong engagement and no observed behavior interfering with access.",
      { domain: "Adaptive" }
    ),
    item(
      "Attention to Task",
      "Participates in a movement or fine-motor activity through completion.",
      "Independence",
      4,
      "Movement-based and visually clear activities remained a relative strength across school changes.",
      { domain: "Regulation" }
    ),
  ];
}

function caregiverContext(date, kind) {
  const morning = kind === "MorningContext";
  return {
    kind: morning ? "morning" : "evening",
    entries: morning
      ? [
          { key: "sleep", label: "Sleep", value: "Good" },
          { key: "breakfast", label: "Breakfast", value: "Ate well" },
          { key: "schoolTransition", label: "School Transition", value: "Smooth" },
        ]
      : [
          { key: "overallEvening", label: "Overall Evening", value: "Calm" },
          { key: "homeRoutine", label: "Home Routine", value: "Smooth" },
          { key: "homework", label: "Homework", value: "Completed" },
        ],
    comment: morning
      ? "Home baseline remained stable before school."
      : `Completed homework and read with his sister; family interaction remained stable (${date}).`,
  };
}

function entryRecord({ date, role, kind = "SessionNote", items = [], note, contextData = null, abcObservations = [] }) {
  return {
    recordType: "entry",
    syntheticId: `sudo-${date}-${role}-${kind}`.toLowerCase(),
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

function btNote(phaseId) {
  const notes = {
    provider_transition:
      "Client engaged with the new BT and tested limits around waiting. Familiar staff and predictable routines supported repair and return to instruction.",
    familiar_routine_stabilization:
      "Client remained academically engaged. Waiting and expressive communication required support, with faster recovery in familiar routines.",
    summer_stability:
      "Client completed structured one-to-one academic activities and transitioned well within the familiar summer routine.",
    new_classroom_baseline:
      "The new classroom initially presented few demands. Client explored the environment and completed work when directly structured.",
    environmental_unpredictability:
      "Play duration and transition warnings varied across staff and days. Waiting, leaving the assigned area, and frustration increased when access changed without a consistent cue.",
    generalization_and_coverage_strain:
      "Skills observed one-to-one did not consistently generalize to speech and inclusion groups. Scheduled BT support was interrupted to assist other students.",
    coordination_breakdown:
      "The client continued to lose access to predictable support while provider roles and inclusion responsibility remained unclear. A supervisor response was requested.",
    coordinated_response:
      "The team began using an agreed visual schedule, transition warnings, request options, and assigned coverage plan. Response improved but remained under monitoring.",
  };
  return notes[phaseId] ?? "Synthetic BT documentation.";
}

function abcFor(date, phaseId) {
  if (date === "2025-08-14") {
    return [
      {
        antecedent:
          "During a novel multi-game rotation, access to a preferred activity ended and the client was expected to wait and rotate before staff understood his request for water.",
        behavior:
          "Left the assigned game area repeatedly, cried and screamed, and did not follow the rotation cue.",
        consequence:
          "Staff clarified the water request, provided water, moved with the client to a lower-stimulation area, and reintroduced the activity with one-to-one support; an administrator checked whether additional support was needed.",
      },
    ];
  }

  if (["environmental_unpredictability", "generalization_and_coverage_strain", "coordination_breakdown"].includes(phaseId)) {
    return [
      {
        antecedent: "A group transition or wait instruction occurred without the established visual cue or consistent transition warning.",
        behavior: "Moved away from the assigned area, interrupted the group, and became tearful when redirected.",
        consequence: "BT used a brief visual cue, labeled the need, clarified the next turn, and supported return to the activity.",
      },
    ];
  }

  return [
    {
      antecedent: "During morning group, the client was told to wait before answering.",
      behavior: "Left the seat and moved toward the sensory area.",
      consequence: "BT redirected, labeled the frustration, reviewed when the turn would occur, and supported return; client waited, answered, and resumed the routine.",
    },
  ];
}

function sourceRecordsForDate(date, schoolDayIndex) {
  const day = parseDate(date).getUTCDay();
  const phase = phaseForDate(date);
  const condition = scenarioConditionForDate(date, schoolDayIndex);
  if (phase.id === "scheduled_break") return [];
  const records = [];

  // BT: daily school coverage, with sparse missing documentation intentionally preserved.
  if (variation(`${date}-bt-missing`, 0, 19) !== 0) {
    const includeAbc = date === "2025-08-14" || day === 1 || ["generalization_and_coverage_strain", "coordination_breakdown"].includes(phase.id);
    records.push(
      entryRecord({
        date,
        role: ROLE.BEHAVIOR_THERAPIST,
        note: btNote(phase.id),
        items: btItems(date, phase.id, condition),
        abcObservations: includeAbc ? abcFor(date, phase.id) : [],
      })
    );
  }

  // Educator: three times weekly Jan-Aug, daily during the Sep-Oct transition.
  if ((date < "2025-09-08" ? [1, 3, 5].includes(day) : true) && variation(`${date}-edu-missing`, 0, 23) !== 0) {
    records.push(
      entryRecord({
        date,
        role: ROLE.EDUCATOR,
        note:
          phase.id === "coordination_breakdown"
            ? "Academic capability remained evident, but classroom participation was affected by inconsistent routines, unclear staff responsibility, and repeated changes in adult availability."
            : "Academic work remained a relative strength; group pacing, waiting, and simultaneous listening-and-writing demands required support.",
        items: educatorItems(date, phase.id, condition),
      })
    );
  }

  // Caregiver: stable home context twice weekly, deliberately contrasting school difficulties.
  if (day === 1 || day === 4) {
    const kind = day === 1 ? "MorningContext" : "EveningContext";
    const contextData = caregiverContext(date, kind);
    records.push(
      entryRecord({
        date,
        role: ROLE.CAREGIVER,
        kind,
        note: contextData.entries.map((entry) => `${entry.label}: ${entry.value}`).concat(`Comment: ${contextData.comment}`).join("\n"),
        contextData,
      })
    );
  }

  // Speech: weekly, with additional group-session evidence during the difficult transition.
  if (day === 2 || (date >= "2025-09-08" && day === 4)) {
    const strained = ["environmental_unpredictability", "generalization_and_coverage_strain", "coordination_breakdown"].includes(phase.id);
    records.push(
      entryRecord({
        date,
        role: ROLE.SPEECH_PATHOLOGIST,
        kind: "SpeechProgress",
        note: strained
          ? "Group speech demands increased waiting, grabbing, interruption, and attempts to leave when the client was not understood or could not immediately access a turn."
          : "Comprehension and literacy remained strong; intelligibility, speaking rate, and functional requesting continued to need visual and modeled support.",
        items: speechItems(date, phase.id, condition),
        contextData: {
          observations: [
            {
              category: "Social Communication",
              observation: strained
                ? "The client attempted to participate but peers had difficulty understanding him; frustration increased when repair supports were delayed."
                : "The client attempted peer interaction and benefited from slowed rate, visual choices, and time to repair the message.",
              recommendation: "Offer visual request options and sufficient processing time before repeating the prompt.",
            },
          ],
        },
      })
    );
  }

  // OT: weekly relative-strength sample; one scheduled session is omitted to model missingness.
  if (day === 4 && variation(`${date}-ot-missing`, 0, 11) !== 0) {
    records.push(
      entryRecord({
        date,
        role: ROLE.OCCUPATIONAL_THERAPIST,
        note: "Client was engaged in movement, handwriting, and fine-motor activities. No behavior prevented access to the session.",
        items: otItems(date, phase.id),
      })
    );
  }

  // Supervisor observations are periodic and event-driven rather than daily.
  if (schoolDayIndex % 20 === 10 || ["2025-08-15", "2025-10-06", "2025-10-21", "2025-10-27"].includes(date)) {
    records.push(
      entryRecord({
        date,
        role: ROLE.SUPERVISOR,
        kind: "SupervisorObservation",
        note:
          date >= "2025-10-06"
            ? "Observation Category: Coordination and implementation\nObservation: Client performance varied with staff predictability and access to the assigned BT. Roles, visual supports, transition warnings, and follow-up ownership were reviewed."
            : "Observation Category: Regulation and communication\nObservation: Academic strengths were evident; waiting and intelligibility were most affected in group and novel settings.",
        contextData: {
          observations: [
            {
              category: "Coordination and implementation",
              observation:
                date >= "2025-10-06"
                  ? "Support availability and routine predictability differed across settings; a coordinated plan and monitoring period were indicated."
                  : "The client responded best to predictable one-to-one structure and multimodal communication support.",
            },
          ],
        },
      })
    );
  }

  return records;
}

function buildCaseSupportRecords() {
  return [
    {
      recordType: "caseSupportRequest",
      syntheticId: "sudo-case-request-2025-10-03",
      date: "2025-10-03T17:00:00.000Z",
      requesterRole: ROLE.BEHAVIOR_THERAPIST,
      recipientRole: ROLE.SUPERVISOR,
      concern:
        "Client access to planned support has been affected by inconsistent classroom routines, repeated reassignment of BT attention, and unclear responsibility during inclusion transitions.",
      requestedSupport:
        "Observe the classroom, clarify agency and school roles, establish a predictable schedule, and coordinate implementation with the special-education team.",
      status: "CASE_OPENED",
    },
    {
      recordType: "caseSupportCase",
      syntheticId: "sudo-case-2025-10",
      date: "2025-10-06T17:00:00.000Z",
      ownerRole: ROLE.SUPERVISOR,
      title: "Classroom predictability and assigned-support coordination",
      concern:
        "Sustained cross-setting difficulty is occurring while established supports and provider coverage are inconsistently available.",
      desiredOutcome:
        "Restore assigned support, define inclusion responsibility, and implement predictable visual and transition supports across staff.",
      status: "RESOLVED",
      resolvedAt: "2025-10-31T17:00:00.000Z",
    },
    {
      recordType: "caseSupportEntry",
      syntheticId: "sudo-case-entry-coverage-2025-10-07",
      date: "2025-10-07T17:00:00.000Z",
      authorRole: ROLE.BEHAVIOR_THERAPIST,
      coverageStatus: "NOT_MAINTAINED",
      scheduleImpacts: ["inclusion transition", "assigned client observation", "speech carryover"],
      whatOccurred:
        "BT was directed to assist other students during portions of the assigned client's scheduled support period.",
      supportProvided:
        "BT prioritized immediate classroom stabilization and documented the resulting interruption to client coverage.",
      observableOutcome:
        "Client missed planned transition preparation and required increased support on return.",
    },
    {
      recordType: "caseSupportCoordination",
      syntheticId: "sudo-coordination-2025-10-21",
      date: "2025-10-21T17:00:00.000Z",
      authorRole: ROLE.SUPERVISOR,
      path: "EXTERNAL",
      status: "MONITORING",
      communicationMethod: "IN_PERSON",
      actionTaken:
        "Supervisor coordinated with the school special-education lead and classroom educator to define staff roles and a daily schedule.",
      requestOrDecision:
        "Assigned BT coverage, inclusion ownership, visual schedule availability, transition warnings, and documentation responsibilities were specified.",
      nextStep: "Monitor implementation for two school weeks before considering the condition stable.",
    },
    {
      recordType: "caseSupportCoordination",
      syntheticId: "sudo-coordination-2025-10-31",
      date: "2025-10-31T17:00:00.000Z",
      authorRole: ROLE.SUPERVISOR,
      path: "INTERNAL",
      status: "COMPLETE",
      communicationMethod: "VIRTUAL_MEETING",
      actionTaken:
        "Reviewed two weeks of implementation evidence and closed the acute coordination case.",
      requestOrDecision:
        "Continue routine monitoring; blue remains unavailable until improvement is sustained beyond the initial implementation period.",
      nextStep: "Reassess generalization and communication repair during November.",
    },
  ];
}

function buildExpectedSignals(evaluableDates) {
  return evaluableDates.map((date, index) => {
    const anchor = ANCHOR_EVENTS.find((event) => event.date === date);
    return {
      date,
      expectedSignal: expectedSignalForDate(date, index),
      scenarioCondition: scenarioConditionForDate(date, index),
      phaseId: phaseForDate(date).id,
      expectedReason: anchor?.id ?? null,
      expectedConfidence: anchor ? "high" : "calibration",
    };
  });
}

function countBy(items, key) {
  return items.reduce((counts, item) => {
    const value = typeof key === "function" ? key(item) : item[key];
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function goalKey(role, target) {
  return `${role}:${target.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function attachGoalKeys(entryRecords) {
  return entryRecords.map((record) => {
    if (record.recordType !== "entry") return record;
    return {
      ...record,
      items: record.items.map((entryItem) => ({
        ...entryItem,
        goalKey: goalKey(record.role, entryItem.target),
      })),
    };
  });
}

function buildGoalDefinitions(entryRecords) {
  const goals = new Map();
  for (const record of entryRecords) {
    if (record.recordType !== "entry") continue;
    for (const entryItem of record.items) {
      if (goals.has(entryItem.goalKey)) continue;
      goals.set(entryItem.goalKey, {
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
  return Array.from(goals.values()).sort((a, b) =>
    a.syntheticKey.localeCompare(b.syntheticKey)
  );
}

function summarize(dataset) {
  const entryRecords = dataset.sourceRecords.filter((record) => record.recordType === "entry");
  const septemberOctober = dataset.expectedSignals.filter(
    (item) => item.date >= "2025-09-08" && item.date <= "2025-10-31"
  );
  const januaryAugust = dataset.expectedSignals.filter((item) => item.date < "2025-09-08");
  return {
    fixtureId: dataset.fixtureId,
    dateRange: PROFILE.dateRange,
    evaluableDays: dataset.expectedSignals.length,
    sourceRecordCount: dataset.sourceRecords.length,
    goalDefinitionCount: dataset.goalDefinitions.length,
    entryCount: entryRecords.length,
    caseSupportRecordCount: dataset.sourceRecords.length - entryRecords.length,
    entryCountsByRole: countBy(entryRecords, "role"),
    entryCountsByKind: countBy(entryRecords, "kind"),
    abcObservationCount: entryRecords.reduce((count, entry) => count + entry.abcObservations.length, 0),
    expectedSignalsJanuaryAugust: countBy(januaryAugust, "expectedSignal"),
    expectedSignalsSeptemberOctober: countBy(septemberOctober, "expectedSignal"),
    anchorEvents: ANCHOR_EVENTS,
  };
}

function buildSuDoTimeline() {
  const evaluableDates = [
    ...weekdaysBetween("2025-01-13", "2025-08-15"),
    ...weekdaysBetween("2025-09-08", "2025-10-31"),
  ];
  const entryRecords = attachGoalKeys(
    evaluableDates.flatMap((date, index) => sourceRecordsForDate(date, index))
  );
  const sourceRecords = [...entryRecords, ...buildCaseSupportRecords()].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const dataset = {
    schemaVersion: 1,
    fixtureId: PROFILE.id,
    profile: PROFILE,
    phases: PHASES,
    goalDefinitions: buildGoalDefinitions(entryRecords),
    sourceRecords,
    expectedSignals: buildExpectedSignals(evaluableDates),
  };
  return { ...dataset, summary: summarize(dataset) };
}

module.exports = {
  ANCHOR_EVENTS,
  PHASES,
  PROFILE,
  ROLE,
  SIGNAL,
  SEPTEMBER_OCTOBER_SIGNAL_WEEKS,
  buildSuDoTimeline,
  expectedSignalForDate,
  phaseForDate,
  weekdaysBetween,
};
