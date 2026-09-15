/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
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

const originalLoad = Module._load;
Module._load = function loadWithSessionScoringAlias(request, parent, isMain) {
  if (request === "@/lib/sessionScoring") {
    return originalLoad.call(
      this,
      require.resolve("../../../../src/lib/sessionScoring.ts"),
      parent,
      isMain
    );
  }
  return originalLoad.call(this, request, parent, isMain);
};
const { buildProviderGoalSeries } = require("../insightContextModel.ts");
Module._load = originalLoad;

function point(sessionId, rawValue, index, overrides = {}) {
  const valueBasis = overrides.valueBasis ?? "rawValue";
  const score = Object.hasOwn(overrides, "score") ? overrides.score : null;
  return {
    itemId: overrides.itemId ?? `${sessionId}-item`,
    sessionId,
    date: overrides.date ?? `2026-08-${String(index + 1).padStart(2, "0")}T17:00:00.000Z`,
    status: overrides.status ?? "COMPLETED",
    completedAt: Object.hasOwn(overrides, "completedAt")
      ? overrides.completedAt
      : `2026-08-${String(index + 1).padStart(2, "0")}T18:00:00.000Z`,
    measurementValue: Object.hasOwn(overrides, "measurementValue")
      ? overrides.measurementValue
      : valueBasis === "score"
        ? score
        : rawValue,
    valueBasis,
    rawValue,
    score,
    normalizedScore: overrides.normalizedScore ?? rawValue,
    changeFromBaseline: null,
    changeFromPrevious: null,
    trendDirection: overrides.trendDirection ?? "flat",
    lowData: overrides.lowData ?? false,
    clinicallySmallButPositiveChange: false,
  };
}

function series(overrides = {}) {
  const providerId = overrides.providerId ?? "provider-a";
  const goalId = Object.hasOwn(overrides, "goalId")
    ? overrides.goalId
    : "goal-shared";
  return {
    providerId,
    providerName: overrides.providerName ?? "Provider A.",
    providerRole: overrides.providerRole ?? "BehaviorTherapist",
    goalKey: overrides.goalKey ?? (goalId ? `goal:${goalId}` : "text:target"),
    goalId,
    target: overrides.target ?? "Target",
    goal: overrides.goal ?? "Record target measurements",
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
    masteryBasis: overrides.masteryBasis ?? null,
    masteredAt: overrides.masteredAt ?? null,
    masteryEvidenceEntryIds: overrides.masteryEvidenceEntryIds ?? [],
    masteryRevokedAt: overrides.masteryRevokedAt ?? null,
    masteryRevokedEvidenceEntryIds:
      overrides.masteryRevokedEvidenceEntryIds ?? [],
    masteryThreshold: overrides.masteryThreshold ?? null,
    masteryRequiredSessions: overrides.masteryRequiredSessions ?? 3,
    metadataConsistent: overrides.metadataConsistent ?? true,
    measurementValueBasis:
      overrides.measurementValueBasis ??
      (overrides.metricType === "Subjective" ? "score" : "rawValue"),
    sessions:
      overrides.sessions ??
      [1, 2, 3].map((value, index) =>
        point(`${providerId}-entry-${index + 1}`, value, index)
      ),
    measurementTrend: overrides.rawTrend ?? "up",
    measurementFirstAverage: overrides.rawFirstAverage ?? 1.5,
    measurementSecondAverage: overrides.rawSecondAverage ?? 3,
    normalizedTrend: overrides.normalizedTrend ?? "up",
    normalizedFirstAverage: overrides.normalizedFirstAverage ?? 1.5,
    normalizedSecondAverage: overrides.normalizedSecondAverage ?? 3,
    trend: overrides.normalizedTrend ?? "up",
  };
}

function documentation(source, providerRole) {
  return {
    id: source.sessionId,
    kind: "SessionNote",
    visibility: "Shared",
    status: "COMPLETED",
    date: source.date,
    createdAt: source.date,
    updatedAt: source.date,
    completedAt: source.date,
    note: "A structured measurement was recorded during the session.",
    clinicalReflection: null,
    contextData: null,
    providerId: source.providerId,
    providerName: source.providerName,
    providerRole,
    observations: [],
    abcObservations: [],
    revisions: [],
  };
}

function context(providerGoalSeries) {
  const providers = new Map();
  const documentationRecords = [];
  for (const item of providerGoalSeries) {
    providers.set(item.providerId, {
      providerId: item.providerId,
      providerName: item.providerName,
      accountRole: item.providerRole,
      assignmentRole: item.providerRole,
    });
    for (const session of item.sessions) {
      documentationRecords.push(
        documentation(
          { ...session, providerId: item.providerId, providerName: item.providerName },
          item.providerRole
        )
      );
    }
  }
  return {
    client: {
      id: "client-measurement",
      firstName: "Test",
      lastName: "Client",
      dateOfBirth: null,
      diagnosis: null,
    },
    query: { intent: "summary" },
    careTeam: [...providers.values()],
    currentTeamFocus: null,
    fieldObservations: [],
    documentationRecords,
    caseSupport: { requests: [], cases: [] },
    providerGoalSeries,
  };
}

function snapshotFor(...items) {
  return buildInsightSnapshot(context(items));
}

function patterns(snapshot) {
  return snapshot.lenses.patterns.findings;
}

function firstPattern(...items) {
  const finding = patterns(snapshotFor(...items))[0];
  assert.ok(finding, "expected a measurement pattern");
  return finding;
}

function subjectiveSeries(target, scores, overrides = {}) {
  return series({
    target,
    metricType: "Subjective",
    comparison: Object.hasOwn(overrides, "comparison")
      ? overrides.comparison
      : null,
    targetValue: Object.hasOwn(overrides, "targetValue")
      ? overrides.targetValue
      : null,
    rawTrend: overrides.rawTrend ?? "up",
    normalizedTrend: overrides.normalizedTrend ?? "up",
    sessions: scores.map((score, index) =>
      point(`${target.toLowerCase()}-entry-${index + 1}`, null, index, {
        score,
        measurementValue: score,
        valueBasis: "score",
        normalizedScore: overrides.normalizedScores?.[index] ?? score,
        lowData: overrides.lowData ?? false,
      })
    ),
    ...overrides,
  });
}

test("context model calculates raw and goal-normalized trends independently", () => {
  const values = [
    { raw: 9, normalized: 1 },
    { raw: 6, normalized: 5 },
    { raw: 3, normalized: 9 },
  ];
  const modeled = buildProviderGoalSeries(
    values.map((value, index) => ({
      id: `modeled-entry-${index + 1}`,
      providerId: "provider-a",
      provider: {
        firstName: "Provider",
        lastName: "Alpha",
        role: "BehaviorTherapist",
      },
      date: new Date(`2026-08-0${index + 1}T17:00:00.000Z`),
      items: [
        {
          id: `modeled-item-${index + 1}`,
          goalId: "goal-duration",
          target: "Transitions",
          goal: "Record transition duration",
          domain: "Behavior",
          metricType: "Duration",
          rawValue: value.raw,
          score: null,
          normalizedScore: value.normalized,
          changeFromBaseline: null,
          changeFromPrevious: null,
          trendDirection: "flat",
          lowData: false,
          clinicallySmallButPositiveChange: false,
          goalDefinition: {
            target: "Transitions",
            goal: "Record transition duration",
            metricType: "Duration",
            targetValue: 4,
            comparison: "LessThan",
          },
        },
      ],
    }))
  );

  assert.equal(modeled.length, 1);
  assert.equal(modeled[0].measurementTrend, "down");
  assert.equal(modeled[0].measurementValueBasis, "rawValue");
  assert.equal(modeled[0].normalizedTrend, "up");
  assert.equal(modeled[0].trend, "up");
  assert.equal(modeled[0].comparison, "LessThan");
  assert.equal(modeled[0].targetValue, 4);
  assert.equal(modeled[0].providerRole, "BehaviorTherapist");
  assert.deepEqual(
    modeled[0].sessions.map((session) => session.itemId),
    ["modeled-item-1", "modeled-item-2", "modeled-item-3"]
  );
});

test("context model uses the canonical native value for every metric type", () => {
  const definitions = [
    { metricType: "Frequency", values: [2, 4, 6], basis: "rawValue" },
    { metricType: "Duration", values: [8, 6, 4], basis: "rawValue" },
    { metricType: "Percentage", values: [40, 60, 80], basis: "rawValue" },
    { metricType: "Subjective", values: [1, 2, 3], basis: "score" },
  ];
  const modeled = buildProviderGoalSeries(
    [0, 1, 2].map((index) => ({
      id: `mapping-entry-${index + 1}`,
      providerId: "provider-a",
      provider: {
        firstName: "Provider",
        lastName: "Alpha",
        role: "BehaviorTherapist",
      },
      date: new Date(`2026-08-0${index + 1}T17:00:00.000Z`),
      items: definitions.map((definition) => {
        const target = `${definition.metricType} target`;
        const goal = `Record ${definition.metricType}`;
        return {
          id: `${definition.metricType}-item-${index + 1}`,
          goalId: `goal-${definition.metricType}`,
          target,
          goal,
          domain: "Communication",
          metricType: definition.metricType,
          rawValue:
            definition.basis === "rawValue" ? definition.values[index] : null,
          score: definition.basis === "score" ? definition.values[index] : 9,
          normalizedScore: 9 - index,
          changeFromBaseline: null,
          changeFromPrevious: null,
          trendDirection: "flat",
          lowData: false,
          clinicallySmallButPositiveChange: false,
          goalDefinition: {
            target,
            goal,
            metricType: definition.metricType,
            targetValue: 5,
            comparison: "GreaterThan",
          },
        };
      }),
    }))
  );

  for (const definition of definitions) {
    const item = modeled.find(
      (candidate) => candidate.metricType === definition.metricType
    );
    assert.ok(item);
    assert.equal(item.measurementValueBasis, definition.basis);
    assert.deepEqual(
      item.sessions.map((session) => session.measurementValue),
      definition.values
    );
    assert.ok(
      item.sessions.every((session) => session.valueBasis === definition.basis)
    );
  }
});

test("Subjective tacting and manding scores restore deterministic rating patterns", () => {
  for (const target of ["Tacting", "Manding"]) {
    const finding = firstPattern(subjectiveSeries(target, [1, 2, 4]));
    assert.equal(finding.measurement.metricType, "Subjective");
    assert.equal(finding.measurement.valueBasis, "score");
    assert.equal(finding.measurement.direction, "increasing");
    assert.match(finding.statement, new RegExp(`${target} ratings increased`, "i"));
    assert.doesNotMatch(finding.statement, /does not establish|progress/i);
    assert.equal(finding.measurement.masteryReady.criterionStatus, "unknown");
    assert.ok(
      finding.sources.every((source) => /recorded rating [124]/i.test(source.excerpt))
    );
  }
});

test("Subjective displayed direction follows score rather than normalized score", () => {
  const finding = firstPattern(
    subjectiveSeries("Prompt support", [4, 3, 1], {
      rawTrend: "down",
      normalizedTrend: "up",
      normalizedScores: [1, 5, 9],
    })
  );
  assert.equal(finding.measurement.direction, "decreasing");
  assert.equal(finding.measurement.normalizedDirection, "increasing");
  assert.match(finding.statement, /ratings decreased/i);
  assert.doesNotMatch(finding.statement, /ratings increased/i);
});

test("normalized score alone never becomes an eligible native measurement", () => {
  const unsupported = series({
    metricType: "Subjective",
    measurementValueBasis: "score",
    sessions: [1, 2, 3].map((normalizedScore, index) =>
      point(`normalized-only-${index + 1}`, null, index, {
        score: null,
        measurementValue: null,
        valueBasis: "score",
        normalizedScore,
      })
    ),
    rawTrend: undefined,
    normalizedTrend: "up",
  });
  assert.deepEqual(patterns(snapshotFor(unsupported)), []);
});

test("series with different native value bases are not combined", () => {
  const scored = subjectiveSeries("Tacting", [1, 2, 3]);
  const rawBased = series({
    target: "Tacting",
    metricType: "Subjective",
    measurementValueBasis: "rawValue",
    providerId: "provider-b",
    providerName: "Provider B.",
    providerRole: "SpeechPathologist",
    sessions: [1, 2, 3].map((value, index) =>
      point(`raw-rating-${index + 1}`, value, index)
    ),
  });
  const findings = patterns(snapshotFor(scored, rawBased));
  assert.equal(findings.length, 2);
  assert.deepEqual(
    new Set(findings.map((finding) => finding.measurement.valueBasis)),
    new Set(["score", "rawValue"])
  );
});

test("limited confidence does not suppress an eligible Subjective pattern", () => {
  const finding = firstPattern(
    subjectiveSeries("Tacting", [1, 2, 3], { lowData: true })
  );
  assert.equal(finding.evidenceStrength, "low");
  assert.equal(finding.supportingRecordCount, 3);
});

test("measurements from different providers do not combine into a criterion series", () => {
  const directional = subjectiveSeries("Tacting", [1, 3]);
  const supporting = subjectiveSeries("Tacting", [4], {
    providerId: "provider-b",
    providerName: "Provider B.",
    providerRole: "SpeechPathologist",
    rawTrend: undefined,
  });
  supporting.sessions[0] = {
    ...supporting.sessions[0],
    itemId: "provider-b-supporting-item",
    sessionId: "provider-b-supporting-entry",
  };
  supporting.measurementTrend = undefined;
  assert.deepEqual(patterns(snapshotFor(directional, supporting)), []);
});

test("three points with only two unique records remain insufficient", () => {
  const duplicate = subjectiveSeries("Tacting", [1, 2, 3]);
  duplicate.sessions[2] = {
    ...duplicate.sessions[2],
    sessionId: duplicate.sessions[1].sessionId,
  };
  assert.deepEqual(patterns(snapshotFor(duplicate)), []);
});

test("Duration with LessThan maps decreasing raw values toward the criterion", () => {
  const finding = firstPattern(
    series({
      target: "Transitions",
      metricType: "Duration",
      comparison: "LessThan",
      targetValue: 2,
      rawTrend: "down",
      rawFirstAverage: 6,
      rawSecondAverage: 3,
    })
  );
  assert.equal(finding.measurement.direction, "decreasing");
  assert.equal(finding.measurement.goalRelationship, "towardCriterion");
  assert.match(finding.statement, /transition.*duration decreased/i);
  assert.doesNotMatch(finding.statement, /improv|regress|better|worse/i);
});

test("Duration with LessThan maps increasing raw values away from the criterion", () => {
  const finding = firstPattern(
    series({
      target: "Transitions",
      metricType: "Duration",
      comparison: "LessThan",
      targetValue: 2,
      rawTrend: "up",
      rawFirstAverage: 3,
      rawSecondAverage: 6,
    })
  );
  assert.equal(finding.measurement.goalRelationship, "awayFromCriterion");
  assert.match(finding.statement, /duration increased/i);
  assert.doesNotMatch(finding.statement, /improv|regress|better|worse/i);
});

test("Frequency with GreaterThan maps increasing raw values toward the criterion", () => {
  const finding = firstPattern(
    series({ target: "Manding", comparison: "GreaterThan", rawTrend: "up" })
  );
  assert.equal(finding.measurement.direction, "increasing");
  assert.equal(finding.measurement.goalRelationship, "towardCriterion");
  assert.match(finding.statement, /manding frequency increased/i);
  assert.doesNotMatch(finding.statement, /improv|regress|better|worse/i);
});

test("Frequency with GreaterThan maps decreasing raw values away from the criterion", () => {
  const finding = firstPattern(
    series({
      target: "Manding",
      comparison: "GreaterThan",
      rawTrend: "down",
      rawFirstAverage: 6,
      rawSecondAverage: 3,
    })
  );
  assert.equal(finding.measurement.goalRelationship, "awayFromCriterion");
  assert.match(finding.statement, /frequency decreased/i);
  assert.doesNotMatch(finding.statement, /improv|regress|better|worse/i);
});

test("missing comparison produces neutral direction wording and no progress claim", () => {
  const finding = firstPattern(
    series({ target: "Manding", comparison: null, rawTrend: "up" })
  );
  assert.equal(finding.measurement.goalRelationship, "unknown");
  assert.match(finding.statement, /frequency increased/i);
  assert.doesNotMatch(finding.statement, /does not establish|progress/i);
  assert.equal(finding.evidenceStrength, "low");
  assert.doesNotMatch(finding.statement, /improv|regress|better|worse|successful|concerning/i);
});

test("missing target value prevents criterion interpretation", () => {
  const finding = firstPattern(
    series({ target: "Tacting", targetValue: null, comparison: "GreaterThan" })
  );
  assert.equal(finding.measurement.goalRelationship, "unknown");
  assert.equal(finding.measurement.targetValue, undefined);
  assert.equal(finding.measurement.comparison, undefined);
  assert.doesNotMatch(finding.statement, /does not establish|progress/i);
});

test("Equal comparison handles movement toward and away from the target", () => {
  const toward = firstPattern(
    series({
      comparison: "Equal",
      targetValue: 5,
      rawTrend: "up",
      rawFirstAverage: 1,
      rawSecondAverage: 4,
    })
  );
  const away = firstPattern(
    series({
      comparison: "Equal",
      targetValue: 5,
      rawTrend: "up",
      rawFirstAverage: 6,
      rawSecondAverage: 9,
    })
  );
  assert.equal(toward.measurement.goalRelationship, "towardCriterion");
  assert.equal(away.measurement.goalRelationship, "awayFromCriterion");
  assert.match(toward.statement, /frequency increased/i);
  assert.match(away.statement, /frequency increased/i);
});

test("stable raw values distinguish criterion coverage from no movement", () => {
  const within = firstPattern(
    series({
      metricType: "Duration",
      comparison: "LessThan",
      targetValue: 5,
      rawTrend: "flat",
      rawFirstAverage: 4,
      rawSecondAverage: 4,
    })
  );
  const outside = firstPattern(
    series({
      metricType: "Duration",
      comparison: "LessThan",
      targetValue: 5,
      sessions: [7, 7, 7].map((value, index) =>
        point(`outside-entry-${index + 1}`, value, index)
      ),
      rawTrend: "flat",
      rawFirstAverage: 7,
      rawSecondAverage: 7,
    })
  );
  assert.equal(within.measurement.direction, "stable");
  assert.equal(within.measurement.goalRelationship, "nearCriterion");
  assert.match(within.statement, /criterion was met in the latest 3 completed sessions/i);
  assert.equal(outside.measurement.goalRelationship, "unknown");
  assert.match(outside.statement, /criterion was not met in the latest completed session/i);
  assert.doesNotMatch(outside.statement, /configuration does not establish|progress/i);
});

test("normalized-score direction is preserved separately and never substituted for raw direction", () => {
  const finding = firstPattern(
    series({
      target: "Transition duration",
      metricType: "Duration",
      comparison: "LessThan",
      rawTrend: "down",
      normalizedTrend: "up",
      rawFirstAverage: 8,
      rawSecondAverage: 4,
    })
  );
  assert.equal(finding.measurement.valueBasis, "rawValue");
  assert.equal(finding.measurement.direction, "decreasing");
  assert.equal(finding.measurement.normalizedDirection, "increasing");
  assert.match(finding.statement, /duration decreased/i);
  assert.doesNotMatch(finding.statement, /duration increased/i);
});

test("clinical target names do not imply favorable or unfavorable meaning", () => {
  for (const target of ["Tacting", "Manding", "Transition"]) {
    const finding = firstPattern(
      series({ target, comparison: null, targetValue: null })
    );
    assert.equal(finding.measurement.goalRelationship, "unknown");
    assert.doesNotMatch(
      finding.statement,
      /improv|regress|better|worse|favorable|unfavorable|positive|negative|successful|concerning/i
    );
  }
});

test("incompatible metric types are emitted as separate findings", () => {
  const duration = series({
    goalId: null,
    goalKey: "text:shared",
    target: "Shared target",
    goal: "Shared goal text",
    metricType: "Duration",
    comparison: "LessThan",
  });
  const frequency = series({
    goalId: null,
    goalKey: "text:shared",
    target: "Shared target",
    goal: "Shared goal text",
    metricType: "Frequency",
    comparison: "LessThan",
    providerId: "provider-b",
    providerName: "Provider B.",
    providerRole: "SpeechPathologist",
  });
  const findings = patterns(snapshotFor(duration, frequency));
  assert.equal(findings.length, 2);
  assert.deepEqual(new Set(findings.map((item) => item.measurement.metricType)), new Set(["Duration", "Frequency"]));
  assert.ok(findings.every((item) => item.supportingRecordCount === 3));
});

test("incompatible comparison rules are not combined", () => {
  const greater = series({ comparison: "GreaterThan" });
  const less = series({
    comparison: "LessThan",
    providerId: "provider-b",
    providerName: "Provider B.",
    providerRole: "SpeechPathologist",
  });
  const findings = patterns(snapshotFor(greater, less));
  assert.equal(findings.length, 2);
  assert.deepEqual(new Set(findings.map((item) => item.measurement.comparison)), new Set(["GreaterThan", "LessThan"]));
});

test("unrelated goal IDs are not combined solely by target or domain", () => {
  const first = series({ goalId: "goal-a", goalKey: "goal:goal-a" });
  const second = series({
    goalId: "goal-b",
    goalKey: "goal:goal-b",
    providerId: "provider-b",
    providerName: "Provider B.",
    providerRole: "SpeechPathologist",
  });
  const findings = patterns(snapshotFor(first, second));
  assert.equal(findings.length, 2);
  assert.ok(findings.every((item) => item.supportingRecordCount === 3));
});

test("provider-specific series remain separate even when directions differ", () => {
  const increasing = series({ rawTrend: "up" });
  const decreasing = series({
    providerId: "provider-b",
    providerName: "Provider B.",
    providerRole: "SpeechPathologist",
    rawTrend: "down",
    rawFirstAverage: 5,
    rawSecondAverage: 2,
  });
  const findings = patterns(snapshotFor(increasing, decreasing));
  assert.equal(findings.length, 2);
  assert.deepEqual(
    new Set(findings.map((finding) => finding.measurement.direction)),
    new Set(["increasing", "decreasing"])
  );
  assert.ok(findings.every((finding) => !/correct|incorrect|better|worse/i.test(finding.statement)));
});

test("unique supporting records are counted once and sources match the used entries", () => {
  const shared = [
    point("entry-1", 1, 0),
    point("entry-2", 2, 1),
    point("entry-3", 3, 2),
  ];
  const first = series({ sessions: shared });
  const second = series({
    providerId: "provider-b",
    providerName: "Provider B.",
    providerRole: "SpeechPathologist",
    sessions: shared.map((item) => ({ ...item, itemId: `${item.itemId}-duplicate` })),
  });
  const finding = firstPattern(first, second);
  assert.equal(finding.supportingRecordCount, 3);
  assert.equal(finding.sources.length, 3);
  assert.deepEqual(
    new Set(finding.sources.map((source) => source.recordId)),
    new Set(["entry-1", "entry-2", "entry-3"])
  );
  assert.ok(finding.sources.every((source) => source.recordType === "entry"));
  assert.ok(finding.sources.every((source) => /Target: recorded \d/.test(source.excerpt)));
});

test("supporting count remains total when View Sources is capped", () => {
  const sessions = Array.from({ length: 8 }, (_, index) =>
    point(`entry-${index + 1}`, index + 1, index)
  );
  const finding = firstPattern(series({ sessions }));
  assert.equal(finding.supportingRecordCount, 8);
  assert.equal(finding.sources.length, 6);
  assert.match(finding.statement, /across 8 comparable measurements/i);
});

test("confidence is reduced for missing and incompatible configuration", () => {
  const missing = series({ comparison: null });
  const incompatible = series({
    comparison: "LessThan",
    providerId: "provider-b",
    providerName: "Provider B.",
    providerRole: "SpeechPathologist",
  });
  const confidence = snapshotFor(missing, incompatible).lenses.confidence.findings;
  const coverage = confidence.find((finding) => finding.title === "Evidence coverage");
  const limitation = confidence.find(
    (finding) => finding.title === "Structured measurement limitations"
  );
  assert.equal(coverage.evidenceStrength, "low");
  assert.equal(limitation.evidenceStrength, "low");
  assert.match(JSON.stringify(limitation), /lack a valid.*criterion|incompatible metric or criterion/i);
});

test("three qualifying completed entries are a candidate but not recorded mastery", () => {
  const finding = firstPattern(
    series({
      target: "Functional communication",
      metricType: "Percentage",
      targetValue: 85,
      comparison: "GreaterThan",
      sessions: [86, 87, 88].map((value, index) =>
        point(`criterion-entry-${index + 1}`, value, index)
      ),
    })
  );
  assert.match(
    finding.statement,
    /criterion was met in the latest 3 completed sessions/i
  );
  assert.doesNotMatch(finding.statement, /master(?:y|ed)/i);
  assert.deepEqual(finding.measurement.masteryReady, {
    measurementDirection: "increased",
    criterionStatus: "met",
    consecutiveCriterionSessions: 3,
    criterionSourceRecordIds: [
      "criterion-entry-1",
      "criterion-entry-2",
      "criterion-entry-3",
    ],
    masteryRuleStatus: "configured",
    requiredConsecutiveCriterionSessions: 3,
    masteryCandidate: true,
    masteryStatus: "notConfirmed",
    promptOrIndependenceStatus: "notApplicable",
    maintenanceStatus: "unknown",
    generalizationStatus: "unknown",
    goalLifecycle: "active",
  });
});

test("POLICY_V1 mastery is stated factually with its exact evidence sessions", () => {
  const item = series({
    target: "Functional communication",
    metricType: "Percentage",
    masteryBasis: "POLICY_V1",
    masteredAt: "2026-08-03T18:00:00.000Z",
    masteryEvidenceEntryIds: ["mastery-1", "mastery-2", "mastery-3"],
    goalIsActive: false,
    sessions: [85, 88, 91].map((value, index) =>
      point(`mastery-${index + 1}`, value, index)
    ),
  });
  const finding = firstPattern(item);
  assert.match(finding.title, /recorded mastery criterion/i);
  assert.match(finding.statement, /using 3 consecutive completed sessions/i);
  assert.deepEqual(
    finding.sources.map((source) => source.recordId),
    ["mastery-1", "mastery-2", "mastery-3"]
  );
  assert.equal(finding.measurement.masteryReady.masteryStatus, "confirmed");
  assert.equal(
    finding.measurement.masteryReady.goalLifecycle,
    "policyMastered"
  );
});

test("corrected POLICY_V1 evidence produces a bounded reopened lifecycle finding", () => {
  const item = series({
    target: "Waiting duration",
    goalIsActive: true,
    masteryRevokedAt: "2026-08-04T18:00:00.000Z",
    masteryRevokedEvidenceEntryIds: ["reopened-1", "reopened-2", "reopened-3"],
    sessions: [2, 3, 4].map((value, index) =>
      point(`reopened-${index + 1}`, value, index)
    ),
  });
  const finding = firstPattern(item);
  assert.match(finding.title, /reopened goal record/i);
  assert.match(finding.statement, /supporting completed-session evidence changed/i);
  assert.equal(
    finding.measurement.masteryReady.goalLifecycle,
    "reopenedAfterCorrection"
  );
});

test("legacy system mastery is historical lifecycle metadata, not confirmation", () => {
  const finding = firstPattern(
    series({ goalIsActive: false, legacyIsMastered: true })
  );
  assert.equal(
    finding.measurement.masteryReady.goalLifecycle,
    "legacySystemMarkedMastered"
  );
  assert.equal(finding.measurement.masteryReady.masteryStatus, "unknown");
  assert.doesNotMatch(finding.statement, /master(?:y|ed)/i);
});

test("prompt and independence profiles remain unknown without authoritative scale metadata", () => {
  for (const measurementProfile of [
    "PromptLevel",
    "CueLevel",
    "CueingLevel",
    "AssistanceLevel",
    "SupportLevel",
    "Independence",
  ]) {
    for (const latestScore of [1, 4]) {
      const finding = firstPattern(
        subjectiveSeries(measurementProfile, [2, 3, latestScore], {
          measurementProfile,
          targetValue: 3,
          comparison: "GreaterThan",
          rawTrend: latestScore === 1 ? "down" : "up",
        })
      );
      assert.equal(
        finding.measurement.masteryReady.promptOrIndependenceStatus,
        "unknown",
        `${measurementProfile} score ${latestScore}`
      );
    }
  }

  const percentageIndependence = firstPattern(
    series({
      target: "Independence",
      metricType: "Percentage",
      measurementProfile: "Independence",
      targetValue: 80,
      comparison: "GreaterThan",
      sessions: [60, 80, 100].map((value, index) =>
        point(`percentage-independence-${index + 1}`, value, index)
      ),
    })
  );
  assert.equal(
    percentageIndependence.measurement.masteryReady.promptOrIndependenceStatus,
    "unknown"
  );
});

test("profiles unrelated to support or independence remain not applicable", () => {
  const participation = firstPattern(
    subjectiveSeries("Participation", [2, 3, 4], {
      measurementProfile: "Participation",
      targetValue: 3,
      comparison: "GreaterThan",
    })
  );
  assert.equal(
    participation.measurement.masteryReady.promptOrIndependenceStatus,
    "notApplicable"
  );
});

test("missing criterion uncertainty appears in Confidence, not Pattern or Significance", () => {
  const snapshot = snapshotFor(series({ comparison: null }));
  const patternAndSignificance = [
    ...snapshot.lenses.patterns.findings,
    ...snapshot.lenses.significance.findings,
  ];
  assert.doesNotMatch(
    JSON.stringify(patternAndSignificance),
    /no valid session criterion|does not establish whether/i
  );
  const confidenceText = JSON.stringify(snapshot.lenses.confidence.findings);
  assert.equal(
    (confidenceText.match(/no valid session criterion is configured/gi) ?? [])
      .length,
    1
  );
});

test("native language names tacting ratings and waiting duration precisely", () => {
  const tacting = firstPattern(
    subjectiveSeries(
      "Tacting",
      Array.from({ length: 10 }, (_, index) => 10 - index),
      { rawTrend: "down" }
    )
  );
  const waiting = firstPattern(
    series({
      providerId: "provider-b",
      target: "Waiting",
      metricType: "Duration",
      sessions: Array.from({ length: 11 }, (_, index) =>
        point(`waiting-entry-${index + 1}`, index + 1, index)
      ),
      rawTrend: "up",
    })
  );
  assert.match(tacting.statement, /Tacting ratings decreased across 10 comparable measurements/i);
  assert.match(waiting.statement, /Waiting duration increased across 11 comparable measurements/i);
  assert.doesNotMatch(`${tacting.statement} ${waiting.statement}`, /improv|regress|master/i);
});

test("significance stays non-prescriptive and contains no provider judgment", () => {
  const snapshot = snapshotFor(
    series(),
    series({
      providerId: "provider-b",
      providerName: "Provider B.",
      providerRole: "SpeechPathologist",
    })
  );
  const serialized = JSON.stringify(snapshot);
  assert.equal(snapshot.lenses.significance.findings.length, 1);
  assert.doesNotMatch(
    serialized,
    /should|needs? (?:retraining|intervention)|treatment plan|recommend|next step|ineffective|best provider|worst provider|provider competen|employment|disciplin/i
  );
});

test("Significance detects compatible same-direction series outside provider-scoped Patterns", () => {
  const first = series({ providerRole: "BehaviorTherapist", rawTrend: "up" });
  const second = series({
    providerId: "provider-b",
    providerName: "Provider B.",
    providerRole: "SpeechPathologist",
    rawTrend: "up",
  });
  const snapshot = snapshotFor(first, second);
  assert.equal(snapshot.lenses.patterns.findings.length, 2);
  assert.ok(
    snapshot.lenses.patterns.findings.every(
      (finding) =>
        new Set(finding.sources.map((source) => source.provider.role)).size === 1
    )
  );
  const significance = snapshot.lenses.significance.findings[0];
  assert.match(
    significance.statement,
    /same recorded direction.*separate compatible series from two provider roles/i
  );
  assert.equal(significance.supportingRecordCount, 6);
  assert.deepEqual(
    new Set(significance.sources.map((source) => source.recordId)),
    new Set([
      "provider-a-entry-1",
      "provider-a-entry-2",
      "provider-a-entry-3",
      "provider-b-entry-1",
      "provider-b-entry-2",
      "provider-b-entry-3",
    ])
  );
  assert.deepEqual(
    new Set(significance.sources.map((source) => source.provider.role)),
    new Set(["BehaviorTherapist", "SpeechPathologist"])
  );
});

test("compatible provider series with different native directions remain separate", () => {
  const snapshot = snapshotFor(
    series({ rawTrend: "up" }),
    series({
      providerId: "provider-b",
      providerName: "Provider B.",
      providerRole: "SpeechPathologist",
      rawTrend: "down",
    })
  );
  const significance = snapshot.lenses.significance.findings[0];
  assert.match(
    significance.statement,
    /different recorded directions.*one client-wide direction is not supported/i
  );
  assert.equal(significance.supportingRecordCount, 6);
  assert.equal(snapshot.lenses.patterns.findings.length, 2);
});

test("incompatible metric or criterion definitions do not produce cross-provider Significance", () => {
  const incompatibleMetric = snapshotFor(
    series({ metricType: "Duration" }),
    series({
      providerId: "provider-b",
      providerRole: "SpeechPathologist",
      metricType: "Frequency",
    })
  );
  assert.deepEqual(incompatibleMetric.lenses.significance.findings, []);

  const incompatibleCriterion = snapshotFor(
    series({ comparison: "GreaterThan", targetValue: 5 }),
    series({
      providerId: "provider-b",
      providerRole: "SpeechPathologist",
      comparison: "LessThan",
      targetValue: 5,
    })
  );
  assert.deepEqual(incompatibleCriterion.lenses.significance.findings, []);

  const incompatibleProfile = snapshotFor(
    series({ measurementProfile: "Frequency" }),
    series({
      providerId: "provider-b",
      providerRole: "SpeechPathologist",
      measurementProfile: "OpportunityCount",
    })
  );
  assert.deepEqual(incompatibleProfile.lenses.significance.findings, []);
});

test("target-only or domain-only similarity is insufficient for cross-provider Significance", () => {
  const snapshot = snapshotFor(
    series({ goalId: "goal-a", target: "Shared target", goal: "Goal A" }),
    series({
      providerId: "provider-b",
      providerRole: "SpeechPathologist",
      goalId: "goal-b",
      target: "Shared target",
      goal: "Goal B",
    })
  );
  assert.deepEqual(snapshot.lenses.significance.findings, []);
});

test("Subjective series without authoritative scale semantics do not produce cross-provider Significance", () => {
  const snapshot = snapshotFor(
    subjectiveSeries("Tacting", [1, 2, 3], {
      targetValue: 2,
      comparison: "GreaterThan",
      measurementProfile: "Tacting",
    }),
    subjectiveSeries("Tacting", [1, 2, 3], {
      providerId: "provider-b",
      providerName: "Provider B.",
      providerRole: "SpeechPathologist",
      targetValue: 2,
      comparison: "GreaterThan",
      measurementProfile: "Tacting",
    })
  );
  assert.ok(
    snapshot.lenses.significance.findings.every(
      (finding) => !/provider series|provider roles/i.test(finding.statement)
    )
  );
});

test("an earlier not-met entry followed by a qualifying streak produces transition Significance", () => {
  const transitioning = series({
    target: "Functional requests",
    targetValue: 5,
    comparison: "GreaterThan",
    sessions: [4, 6, 7, 8].map((value, index) =>
      point(`transition-entry-${index + 1}`, value, index)
    ),
    rawTrend: "up",
  });
  const snapshot = snapshotFor(transitioning);
  assert.match(
    snapshot.lenses.patterns.findings[0].statement,
    /criterion was met in the latest 3 completed sessions/i
  );
  const significance = snapshot.lenses.significance.findings[0];
  assert.match(
    significance.statement,
    /latest 3 completed sessions met.*after an earlier completed session did not/i
  );
  assert.deepEqual(
    significance.sources.map((source) => source.recordId),
    [
      "transition-entry-1",
      "transition-entry-2",
      "transition-entry-3",
      "transition-entry-4",
    ]
  );
  assert.equal(significance.supportingRecordCount, 4);
});

test("a qualifying streak without an earlier transition is not repeated in Significance", () => {
  const snapshot = snapshotFor(
    series({
      sessions: [6, 7, 8].map((value, index) =>
        point(`qualifying-entry-${index + 1}`, value, index)
      ),
    })
  );
  assert.match(
    snapshot.lenses.patterns.findings[0].statement,
    /criterion was met in the latest 3 completed sessions/i
  );
  assert.deepEqual(snapshot.lenses.significance.findings, []);
});

test("one provider Tacting or Manding rating pattern can leave Significance empty", () => {
  for (const target of ["Tacting", "Manding"]) {
    const snapshot = snapshotFor(subjectiveSeries(target, [1, 2, 3]));
    assert.equal(snapshot.lenses.patterns.findings.length, 1);
    assert.deepEqual(snapshot.lenses.significance.findings, []);
  }
});

test("Significance language remains factual and non-prescriptive", () => {
  const snapshot = snapshotFor(
    series({ rawTrend: "up" }),
    series({
      providerId: "provider-b",
      providerRole: "SpeechPathologist",
      rawTrend: "down",
    })
  );
  const text = JSON.stringify(snapshot.lenses.significance.findings);
  assert.doesNotMatch(
    text,
    /master(?:y|ed)|progress|regress|maintenance|generalization|recommend|should|good|bad|better|worse|treatment/i
  );
});

test("Significance preserves total source count while View Sources remains capped", () => {
  const sourceSeries = (providerId, providerRole) =>
    series({
      providerId,
      providerRole,
      sessions: [1, 2, 3, 4].map((value, index) =>
        point(`${providerId}-source-${index + 1}`, value, index)
      ),
      rawTrend: "up",
    });
  const snapshot = snapshotFor(
    sourceSeries("provider-a", "BehaviorTherapist"),
    sourceSeries("provider-b", "SpeechPathologist")
  );
  const significance = snapshot.lenses.significance.findings[0];
  assert.equal(significance.supportingRecordCount, 8);
  assert.equal(significance.sources.length, 6);
  assert.ok(
    significance.sources.every((source) =>
      /^provider-[ab]-source-[1-4]$/.test(source.recordId)
    )
  );
});
