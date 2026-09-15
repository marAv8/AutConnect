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

const { buildInsightSnapshot } = require("../insightSnapshot.ts");
const { INSIGHT_LENSES } = require("../../../libs/insights/lenses.ts");
const { deriveClientSignal } = require("../../../libs/clientSignal/deriveClientSignal.ts");

function documentation(overrides = {}) {
  const id = overrides.id ?? "entry-1";
  return {
    id,
    kind: overrides.kind ?? "SessionNote",
    visibility: "Shared",
    status: overrides.status ?? "COMPLETED",
    date: overrides.date ?? "2026-08-10T17:00:00.000Z",
    createdAt: overrides.date ?? "2026-08-10T17:00:00.000Z",
    updatedAt: overrides.date ?? "2026-08-10T17:00:00.000Z",
    completedAt: overrides.date ?? "2026-08-10T17:00:00.000Z",
    note: overrides.note ?? "The client completed four documented opportunities.",
    clinicalReflection: overrides.clinicalReflection ?? null,
    contextData: overrides.contextData ?? null,
    providerId: overrides.providerId ?? "provider-a",
    providerName: overrides.providerName ?? "Provider A.",
    providerRole: overrides.providerRole ?? "BehaviorTherapist",
    observations: overrides.observations ?? [],
    abcObservations: [],
    revisions: [],
  };
}

function goalSeries(overrides = {}) {
  return {
    providerId: overrides.providerId ?? "provider-a",
    providerName: overrides.providerName ?? "Provider A.",
    providerRole: overrides.providerRole ?? "BehaviorTherapist",
    goalKey: overrides.goalKey ?? "goal:shared-goal",
    goalId: overrides.goalId ?? "shared-goal",
    target: overrides.target ?? "Functional requests",
    goal: overrides.goal ?? "Record functional requests",
    domain: overrides.domain ?? "Communication",
    metricType: overrides.metricType ?? "Frequency",
    targetValue: Object.hasOwn(overrides, "targetValue")
      ? overrides.targetValue
      : 5,
    comparison: Object.hasOwn(overrides, "comparison")
      ? overrides.comparison
      : "GreaterThan",
    measurementProfile: overrides.measurementProfile ?? null,
    goalIsActive: Object.hasOwn(overrides, "goalIsActive")
      ? overrides.goalIsActive
      : true,
    legacyIsMastered: overrides.legacyIsMastered ?? false,
    metadataConsistent: overrides.metadataConsistent ?? true,
    measurementValueBasis: overrides.measurementValueBasis ?? "rawValue",
    measurementTrend: overrides.rawTrend ?? overrides.trend ?? "up",
    measurementFirstAverage: overrides.rawFirstAverage ?? 1,
    measurementSecondAverage: overrides.rawSecondAverage ?? 2,
    normalizedTrend: overrides.normalizedTrend ?? overrides.trend ?? "up",
    normalizedFirstAverage: overrides.normalizedFirstAverage ?? 1,
    normalizedSecondAverage: overrides.normalizedSecondAverage ?? 2,
    trend: overrides.trend ?? "up",
    sessions: overrides.sessions ?? [],
  };
}

function seriesSession(sessionId, date, trendDirection) {
  return {
    itemId: `${sessionId}-item`,
    sessionId,
    date,
    status: "COMPLETED",
    completedAt: date,
    measurementValue: 2,
    valueBasis: "rawValue",
    rawValue: 2,
    score: null,
    normalizedScore: 6,
    changeFromBaseline: 1,
    changeFromPrevious: 0.5,
    trendDirection,
    lowData: false,
    clinicallySmallButPositiveChange: false,
  };
}

function baseContext(overrides = {}) {
  const records = overrides.documentationRecords ?? [
    documentation({ id: "entry-a1", date: "2026-08-07T17:00:00.000Z" }),
    documentation({ id: "entry-a2", date: "2026-08-08T17:00:00.000Z" }),
    documentation({
      id: "entry-b1",
      date: "2026-08-09T17:00:00.000Z",
      providerId: "provider-b",
      providerName: "Provider B.",
      providerRole: "SpeechPathologist",
    }),
    documentation({
      id: "entry-b2",
      date: "2026-08-10T17:00:00.000Z",
      providerId: "provider-b",
      providerName: "Provider B.",
      providerRole: "SpeechPathologist",
      note: "Possibly it changed, but the timing is unclear.",
    }),
  ];
  return {
    client: {
      id: "client-1",
      firstName: "Test",
      lastName: "Client",
      dateOfBirth: null,
      diagnosis: null,
    },
    query: { intent: "summary" },
    careTeam: [
      {
        providerId: "provider-a",
        providerName: "Provider A.",
        accountRole: "BehaviorTherapist",
        assignmentRole: "BehaviorTherapist",
      },
      {
        providerId: "provider-b",
        providerName: "Provider B.",
        accountRole: "SpeechPathologist",
        assignmentRole: "SpeechPathologist",
      },
    ],
    currentTeamFocus: {
      id: "team-focus-1",
      title: "Transition context",
      content: "A hidden directive must not be copied into the snapshot.",
      updatedAt: "2026-08-10T18:00:00.000Z",
      authorName: "Supervisor S.",
      authorRole: "Supervisor",
    },
    fieldObservations: [
      {
        id: "field-observation-1",
        observedAt: "2026-08-09T16:00:00.000Z",
        setting: "SCHOOL",
        durationMinutes: 30,
        observedProvider: {
          id: "provider-a",
          name: "Provider A.",
          role: "BehaviorTherapist",
        },
        supervisor: { name: "Supervisor S." },
        rubricVersion: "1.0",
        fidelityPercent: 75,
        applicableItemCount: 8,
        items: [],
        strengths: "Prepared materials.",
        coachingFocus: "PROHIBITED_COACHING_SECRET",
        followUp: "PROHIBITED_FOLLOW_UP_SECRET",
      },
      {
        id: "field-observation-2",
        observedAt: "2026-08-10T16:00:00.000Z",
        setting: "SCHOOL",
        durationMinutes: 30,
        observedProvider: {
          id: "provider-a",
          name: "Provider A.",
          role: "BehaviorTherapist",
        },
        supervisor: { name: "Supervisor S." },
        rubricVersion: "1.0",
        fidelityPercent: 80,
        applicableItemCount: 8,
        items: [],
        strengths: null,
        coachingFocus: null,
        followUp: null,
      },
    ],
    documentationRecords: records,
    caseSupport: {
      requests: [
        {
          id: "case-request-1",
          concern: "A routine change was documented.",
          requestedSupport: "PROHIBITED_REQUESTED_SUPPORT_SECRET",
          status: "ACKNOWLEDGED",
          responseNote: null,
          createdAt: "2026-08-08T15:00:00.000Z",
          updatedAt: "2026-08-10T15:00:00.000Z",
          requesterName: "Provider A.",
          requesterRole: "BehaviorTherapist",
          recipientSupervisorName: "Supervisor S.",
        },
      ],
      cases: [
        {
          id: "case-1",
          title: "Routine record",
          concern: "A routine change was documented.",
          desiredOutcome: "PROHIBITED_DESIRED_OUTCOME_SECRET",
          status: "OPEN",
          createdAt: "2026-08-08T15:00:00.000Z",
          updatedAt: "2026-08-10T15:00:00.000Z",
          resolvedAt: null,
          ownerName: "Supervisor S.",
          entries: [
            {
              id: "case-entry-1",
              entryType: "PROVIDER_ACCOUNT",
              occurredAt: "2026-08-10T14:00:00.000Z",
              whatOccurred: "The classroom routine changed before arrival.",
              supportProvided: "PROHIBITED_SUPPORT_SECRET",
              observableOutcome: "The change was recorded.",
              communication: null,
              followUp: "PROHIBITED_ENTRY_FOLLOW_UP_SECRET",
              clarification: null,
              authorName: "Provider A.",
              authorRole: "BehaviorTherapist",
            },
          ],
          coordinations: [
            {
              id: "coordination-1",
              path: "INTERNAL",
              status: "DOCUMENTED",
              occurredAt: "2026-08-10T14:30:00.000Z",
              actionTaken: "A contact was recorded.",
              requestOrDecision: "A decision was recorded.",
              responseSummary: null,
              nextStep: "PROHIBITED_NEXT_STEP_SECRET",
              authorName: "Supervisor S.",
            },
          ],
        },
      ],
    },
    providerGoalSeries: [
      goalSeries({
        providerId: "provider-a",
        trend: "up",
        sessions: [
          seriesSession("entry-a1", "2026-08-07T17:00:00.000Z", "up"),
          seriesSession("entry-a2", "2026-08-08T17:00:00.000Z", "up"),
        ],
      }),
      goalSeries({
        providerId: "provider-b",
        providerName: "Provider B.",
        trend: "down",
        sessions: [
          seriesSession("entry-b1", "2026-08-09T17:00:00.000Z", "down"),
          seriesSession("entry-b2", "2026-08-10T17:00:00.000Z", "down"),
        ],
      }),
    ],
    ...overrides,
  };
}

function allFindings(snapshot) {
  return INSIGHT_LENSES.flatMap((lens) => snapshot.lenses[lens].findings);
}

test("snapshot contains exactly the five supported lenses and no advice-shaped fields", () => {
  const snapshot = buildInsightSnapshot(baseContext());
  assert.deepEqual(Object.keys(snapshot.lenses), INSIGHT_LENSES);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /"question"|"nextSteps?"|"recommendations?"|"treatment"|"actionPlan"/i);
  assert.doesNotMatch(serialized, /PROHIBITED_/);
});

test("finding IDs and generatedAt are stable across identical inputs", () => {
  const context = baseContext();
  const first = buildInsightSnapshot(context);
  const second = buildInsightSnapshot(context);
  assert.deepEqual(
    allFindings(first).map((finding) => finding.id),
    allFindings(second).map((finding) => finding.id)
  );
  assert.equal(first.generatedAt, second.generatedAt);
});

test("every finding has stable database-backed source IDs", () => {
  const findings = allFindings(buildInsightSnapshot(baseContext()));
  assert.ok(findings.length > 0);
  for (const finding of findings) {
    assert.ok(finding.sources.length > 0, finding.id);
    for (const source of finding.sources) {
      assert.ok(source.recordId);
      assert.equal(source.id, `${source.recordType}:${source.recordId}`);
      assert.doesNotMatch(source.recordId, /^S\d+$/);
    }
  }
});

test("observations remain factual and ambiguous wording lowers evidence strength", () => {
  const snapshot = buildInsightSnapshot(baseContext());
  const observations = snapshot.lenses.observations.findings;
  assert.ok(observations.every((finding) => finding.classification === "observation"));
  assert.ok(observations.every((finding) => !/caused|because of|intended|motivated/i.test(finding.statement)));
  const latest = observations.find((finding) => finding.title === "Recent completed documentation");
  assert.equal(latest.evidenceStrength, "low");
  assert.ok(latest.limitations.length > 0);
});

test("one short measurement series does not become a pattern", () => {
  const context = baseContext({
    documentationRecords: [documentation({ id: "entry-only-1" }), documentation({ id: "entry-only-2" })],
    providerGoalSeries: [
      goalSeries({
        sessions: [
          seriesSession("entry-only-1", "2026-08-09T17:00:00.000Z", "up"),
          seriesSession("entry-only-2", "2026-08-10T17:00:00.000Z", "up"),
        ],
      }),
    ],
  });
  const snapshot = buildInsightSnapshot(context);
  assert.deepEqual(snapshot.lenses.patterns.findings, []);
});

test("structured provider series are reported separately without choosing a winner", () => {
  const snapshot = buildInsightSnapshot(baseContext());
  assert.deepEqual(snapshot.lenses.patterns.findings, []);
});

test("Patterns are not capped at three and retain each provider contributor", () => {
  const roles = [
    "BehaviorTherapist",
    "SpeechPathologist",
    "OccupationalTherapist",
    "Educator",
  ];
  const records = [];
  const series = roles.map((providerRole, providerIndex) => {
    const providerId = `provider-${providerIndex}`;
    const sessions = [1, 2, 3].map((sessionIndex) => {
      const id = `${providerId}-entry-${sessionIndex}`;
      const date = `2026-08-${String(providerIndex * 3 + sessionIndex).padStart(2, "0")}T17:00:00.000Z`;
      records.push(
        documentation({
          id,
          date,
          providerId,
          providerName: `Provider ${providerIndex + 1}.`,
          providerRole,
        })
      );
      return seriesSession(id, date, "up");
    });
    return goalSeries({
      providerId,
      providerName: `Provider ${providerIndex + 1}.`,
      providerRole,
      goalId: `goal-${providerIndex}`,
      goalKey: `goal:goal-${providerIndex}`,
      target: `Target ${providerIndex + 1}`,
      sessions,
    });
  });

  const snapshot = buildInsightSnapshot(
    baseContext({ documentationRecords: records, providerGoalSeries: series })
  );
  const patterns = snapshot.lenses.patterns.findings;
  assert.equal(patterns.length, 4);
  assert.deepEqual(
    patterns.map((finding) => finding.contributor.role).sort(),
    [...roles].sort()
  );
  assert.ok(patterns.every((finding) => finding.contributor.kind === "provider"));
});

test("caregiver Patterns summarize repeated context and keep medication separate from outcomes", () => {
  const caregiverRecords = [
    ["caregiver-1", "2026-08-01T08:00:00.000Z", "Given", "Good"],
    ["caregiver-2", "2026-08-02T08:00:00.000Z", "Given", "Good"],
    ["caregiver-3", "2026-08-03T08:00:00.000Z", "Not given", "Restless"],
  ].map(([id, date, medication, sleep]) =>
    documentation({
      id,
      date,
      kind: "MorningContext",
      providerId: "caregiver-a",
      providerName: "Caregiver A.",
      providerRole: "Caregiver",
      contextData: {
        entries: [
          { key: "medication", label: "Medication", value: medication },
          { key: "sleep", label: "Sleep", value: sleep },
        ],
      },
    })
  );
  const snapshot = buildInsightSnapshot(
    baseContext({ documentationRecords: caregiverRecords, providerGoalSeries: [] })
  );
  const patterns = snapshot.lenses.patterns.findings;
  assert.equal(patterns.length, 2);
  assert.ok(patterns.every((finding) => finding.contributor.kind === "caregiverContext"));
  const medication = patterns.find((finding) => finding.title === "Medication");
  assert.ok(medication);
  assert.match(medication.statement, /given in 2, not given in 1/i);
  assert.match(medication.statement, /without linking it to provider observations or client outcomes/i);
  assert.equal(medication.supportingRecordCount, 3);
});

test("insufficient context produces empty lenses without invented findings", () => {
  const context = baseContext({
    currentTeamFocus: null,
    fieldObservations: [],
    documentationRecords: [],
    caseSupport: { requests: [], cases: [] },
    providerGoalSeries: [],
  });
  const snapshot = buildInsightSnapshot(context);
  for (const lens of INSIGHT_LENSES) {
    assert.deepEqual(snapshot.lenses[lens].findings, []);
  }
});

test("only authorized Case Support input contributes and restricted fields remain excluded", () => {
  const context = baseContext();
  const snapshot = buildInsightSnapshot(context);
  const sources = allFindings(snapshot).flatMap((finding) => finding.sources);
  assert.ok(sources.some((source) => source.recordId === "case-1"));
  assert.ok(sources.some((source) => source.recordId === "case-entry-1"));
  assert.ok(sources.every((source) => source.recordId !== "coordination-1"));
  assert.doesNotMatch(JSON.stringify(snapshot), /PROHIBITED_/);
});

test("Team Focus and Case Support context contains substantive facts without generic filler", () => {
  const snapshot = buildInsightSnapshot(baseContext());
  const contextFindings = snapshot.lenses.context.findings;
  const text = JSON.stringify(contextFindings);
  assert.match(text, /Transition context/);
  assert.match(text, /2 Field Observations were recorded in school/i);
  assert.match(text, /Case Support case.*open.*2026-08-10/i);
  assert.doesNotMatch(
    text,
    /presence of a Team Focus is contextual|Case Support status is contextual|does not explain other client records|not a causal explanation/i
  );
  assert.deepEqual(snapshot.lenses.significance.findings, []);
});

test("the five lenses contain no generic relevance or causal disclaimers", () => {
  const snapshot = buildInsightSnapshot(baseContext());
  const userFacingText = INSIGHT_LENSES.flatMap((lens) =>
    snapshot.lenses[lens].findings.flatMap((finding) => [
      finding.title,
      finding.statement,
      ...finding.limitations,
    ])
  ).join(" ");
  assert.doesNotMatch(
    userFacingText,
    /may be relevant|not a causal explanation|does not establish a cause|presence of more than one authorized record type|one bounded observation|cannot explain|does not explain/i
  );
});

test("uncertainty stays in Confidence and equivalent criterion disclaimers are not repeated", () => {
  const missingCriterionSeries = goalSeries({
    comparison: null,
    sessions: [
      seriesSession("missing-entry-1", "2026-08-07T17:00:00.000Z", "up"),
      seriesSession("missing-entry-2", "2026-08-08T17:00:00.000Z", "up"),
      seriesSession("missing-entry-3", "2026-08-09T17:00:00.000Z", "up"),
    ],
  });
  const snapshot = buildInsightSnapshot(
    baseContext({ providerGoalSeries: [missingCriterionSeries] })
  );
  const lensText = Object.fromEntries(
    INSIGHT_LENSES.map((lens) => [
      lens,
      snapshot.lenses[lens].findings
        .flatMap((finding) => [finding.statement, ...finding.limitations])
        .join(" "),
    ])
  );
  assert.doesNotMatch(
    `${lensText.patterns} ${lensText.context} ${lensText.significance}`,
    /criterion.*(?:missing|not configured|does not establish)/i
  );
  assert.equal(
    (lensText.confidence.match(/no valid session criterion is configured/gi) ?? [])
      .length,
    1
  );
});

test("user-facing findings make no mastery, progress, regression, maintenance, or generalization claim", () => {
  const snapshot = buildInsightSnapshot(baseContext());
  const claims = allFindings(snapshot)
    .flatMap((finding) => [finding.statement, ...finding.limitations])
    .join(" ");
  assert.doesNotMatch(
    claims,
    /\bmastered\b|confirmed mastery|\bprogress(?:ed|ing)?\b|\bregress(?:ed|ion|ing)?\b|maintenance (?:is )?(?:supported|established)|generalization (?:is )?(?:supported|established)/i
  );
});

test("snapshot contains no provider ranking or provider judgment", () => {
  const serialized = JSON.stringify(buildInsightSnapshot(baseContext()));
  assert.doesNotMatch(serialized, /best provider|worst provider|rank(?:ed|ing)? provider|provider competen|disciplin|employment/i);
  assert.doesNotMatch(serialized, /fidelityPercent|normalizedScore|providerScore/i);
});

test("the pure builder does not mutate its input", () => {
  const context = baseContext();
  const before = JSON.stringify(context);
  buildInsightSnapshot(context);
  assert.equal(JSON.stringify(context), before);
});

test("building a snapshot does not affect client-signal derivation", () => {
  const signalInput = {
    now: new Date("2026-08-11T20:00:00.000Z"),
    entries: [
      {
        id: "signal-entry-1",
        providerId: "provider-a",
        providerRole: "BehaviorTherapist",
        date: "2026-08-10T17:00:00.000Z",
        note: null,
        items: [],
        abcObservations: [],
      },
    ],
  };
  const before = deriveClientSignal(signalInput);
  buildInsightSnapshot(baseContext());
  const after = deriveClientSignal(signalInput);
  assert.deepEqual(after, before);
});
