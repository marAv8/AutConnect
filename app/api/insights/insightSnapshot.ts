import {
  INSIGHT_LENSES,
  INSIGHT_LENS_LABELS,
  type InsightLens,
} from "../../libs/insights/lenses";
import type { InsightContext } from "./insightContextTypes";
import type {
  InsightFinding,
  InsightGoalRelationship,
  InsightMeasurementDirection,
  InsightMeasurementMeaning,
  InsightSnapshot,
  InsightSource,
  InsightSourceRecordType,
} from "./insightSnapshotContract";
import {
  calculateCriterionStreak,
  evaluateNativeCriterion,
  type NativeCriterionStatus,
} from "../../libs/mastery/nativeCriterion";
import {
  evaluateMasteryCandidate,
  type MasteryCandidateMetricType,
} from "../../libs/mastery/masteryCandidatePolicy";

const MAX_FINDINGS_PER_LENS = 3;
const MAX_CAREGIVER_CONTEXT_FINDINGS_PER_CONTRIBUTOR = 4;
const MAX_SOURCES_PER_FINDING = 6;
const AMBIGUOUS_LANGUAGE =
  /\b(unclear|unknown|unspecified|not documented|not recorded|possibly|maybe|seemed|appeared)\b/i;
const PROHIBITED_EXCERPT_LANGUAGE =
  /\b(recommend(?:ed|ation|ations)?|next steps?|follow[- ]?up|coaching|treat(?:ment|ments)?|should|action plan|employment|disciplin(?:ary|e)?|competen(?:cy|ce|t)|requested support|desired outcome)\b/i;

type DocumentationRecord = InsightContext["documentationRecords"][number];
type GoalSeries = InsightContext["providerGoalSeries"][number];

type SnapshotBuildOptions = {
  generatedAt?: string;
};

export function buildInsightSnapshot(
  context: InsightContext,
  options: SnapshotBuildOptions = {}
): InsightSnapshot {
  const observations = observationFindings(context);
  const patterns = patternFindings(context);
  const contextFindings = associatedContextFindings(context);
  const confidence = confidenceFindings(context, patterns);
  const significance = significanceFindings(context);

  const findingsByLens: Record<InsightLens, InsightFinding[]> = {
    observations,
    patterns,
    context: contextFindings,
    confidence,
    significance,
  };

  return {
    clientId: context.client.id,
    generatedAt: options.generatedAt ?? latestContextTimestamp(context),
    lenses: Object.fromEntries(
      INSIGHT_LENSES.map((lens) => [
        lens,
        {
          label: INSIGHT_LENS_LABELS[lens],
          findings:
            lens === "patterns"
              ? findingsByLens[lens]
              : findingsByLens[lens].slice(0, MAX_FINDINGS_PER_LENS),
        },
      ])
    ) as InsightSnapshot["lenses"],
  };
}

function observationFindings(context: InsightContext): InsightFinding[] {
  const findings: InsightFinding[] = [];
  const latestDocumentation = [...context.documentationRecords].sort(
    (left, right) => recordTime(right) - recordTime(left)
  )[0];

  if (latestDocumentation) {
    const source = documentationSource(latestDocumentation);
    const ambiguous = documentationIsAmbiguous(latestDocumentation);
    findings.push(
      finding("observations", "latest-documentation", {
        title: "Recent completed documentation",
        statement: `${latestDocumentation.providerRole} documentation was completed on ${dateLabel(
          latestDocumentation.completedAt ?? latestDocumentation.date
        )}.`,
        classification: "observation",
        evidenceStrength: ambiguous ? "low" : "medium",
        limitations: ambiguous
          ? ["The record contains unclear or incomplete wording and is reported without added interpretation."]
          : [],
        sources: [source],
      })
    );
  }

  const latestFieldObservation = [...context.fieldObservations].sort(
    (left, right) =>
      Date.parse(right.observedAt) - Date.parse(left.observedAt)
  )[0];
  if (latestFieldObservation) {
    const setting = humanize(latestFieldObservation.setting);
    findings.push(
      finding("observations", "latest-field-observation", {
        title: "Recent Field Observation",
        statement: `A Field Observation involving the ${humanize(
          latestFieldObservation.observedProvider.role
        )} role was recorded${setting ? ` in ${setting.toLowerCase()}` : ""} on ${dateLabel(
          latestFieldObservation.observedAt
        )}.`,
        classification: "observation",
        evidenceStrength: "medium",
        limitations: [],
        sources: [fieldObservationSource(latestFieldObservation)],
      })
    );
  }

  const latestCaseEntry = context.caseSupport.cases
    .flatMap((caseRecord) =>
      caseRecord.entries.map((entry) => ({ caseRecord, entry }))
    )
    .sort(
      (left, right) =>
        Date.parse(right.entry.occurredAt) - Date.parse(left.entry.occurredAt)
    )[0];
  if (latestCaseEntry) {
    findings.push(
      finding("observations", "case-support-entry", {
        title: "Accessible Case Support documentation",
        statement: `An accessible Case Support entry was recorded on ${dateLabel(
          latestCaseEntry.entry.occurredAt
        )}.`,
        classification: "observation",
        evidenceStrength: "medium",
        limitations: [],
        sources: [caseSupportEntrySource(latestCaseEntry.entry)],
      })
    );
  }

  return findings;
}

function masteryLifecycleFindings(context: InsightContext): InsightFinding[] {
  const findings: InsightFinding[] = [];
  for (const series of context.providerGoalSeries) {
    const isPolicyMastered = series.masteryBasis === "POLICY_V1";
    const isReopened =
      !isPolicyMastered &&
      Boolean(series.masteryRevokedAt) &&
      series.goalIsActive === true;
    if (!isPolicyMastered && !isReopened) continue;

    const evidenceIds = isPolicyMastered
      ? series.masteryEvidenceEntryIds
      : series.masteryRevokedEvidenceEntryIds;
    const evidenceSessions = series.sessions.filter((session) =>
      evidenceIds.includes(session.sessionId)
    );
    const sources = sourcesForSelectedSessions(
      series,
      evidenceSessions,
      context
    );
    if (sources.length === 0) continue;

    const subject = safeFindingSubject(series.target);
    findings.push(
      finding(
        "patterns",
        isPolicyMastered ? "policy-mastery-recorded" : "policy-mastery-reopened",
        {
          title: isPolicyMastered
            ? `Recorded mastery criterion for ${subject}`
            : `Reopened goal record for ${subject}`,
          statement: isPolicyMastered
            ? `The system recorded the mastery criterion for ${subject} as met on ${dateLabel(
                series.masteredAt ?? evidenceSessions.at(-1)?.date ?? ""
              )} using ${sources.length} consecutive completed session${
                sources.length === 1 ? "" : "s"
              }.`
            : `The automatic mastery record for ${subject} was removed on ${dateLabel(
                series.masteryRevokedAt ?? ""
              )} after its supporting completed-session evidence changed. The goal is currently active.`,
          classification: "observation",
          evidenceStrength: "high",
          limitations: [],
          sources,
          supportingRecordCount: evidenceIds.length,
          measurement: measurementMeaning([series]),
          contributor: contributorForGoalSeries(series),
        }
      )
    );
  }
  return findings;
}

function patternFindings(context: InsightContext): InsightFinding[] {
  const eligible = context.providerGoalSeries.filter(
    (series) => uniqueMeasurementSessions(series).length > 0
  );
  const grouped = groupGoalSeries(eligible);
  const findings: InsightFinding[] = masteryLifecycleFindings(context);

  for (const seriesGroup of grouped) {
    const sources = sourcesForSeries(seriesGroup, context);
    const subject = safeFindingSubject(seriesGroup[0].target);
    const meaning = measurementMeaning(seriesGroup);
    const providerRoles = new Set(
      seriesGroup.map((series) => series.providerRole).filter(Boolean)
    );
    const lowData = seriesGroup.some((series) =>
      series.sessions.some((session) => session.lowData)
    );
    if (sources.length < 3) continue;

    if (meaning.direction === "mixed") {
      findings.push(
        finding("patterns", "contradictory-trends", {
          title: `Differing recorded trends for ${subject}`,
          statement: `Recorded ${measurementValuesLabel(
            meaning.metricType
          )} for ${subject} do not show one comparable direction across ${sources.length} unique records. The provider series are presented together without selecting one interpretation.`,
          classification: "inference",
          evidenceStrength: "low",
          limitations: [
            "The series may reflect different service conditions, measurement opportunities, or time periods.",
          ],
          sources,
          measurement: meaning,
          contributor: contributorForGoalSeries(seriesGroup[0]),
        })
      );
      continue;
    }

    if (meaning.direction === "insufficient") continue;
    const validCriterion = measurementHasValidCriterion(meaning);
    const criterionResolved =
      validCriterion && meaning.goalRelationship !== "mixed";
    const limitations = [
      ...(lowData ? ["One or more contributing series are marked as low data."] : []),
    ];
    findings.push(
      finding("patterns", `raw-${meaning.direction}`, {
        title: `Recorded pattern for ${subject}`,
        statement: `Recorded ${subject} ${metricLabel(
          meaning.metricType
        )} ${directionPhrase(meaning.direction)} across ${sources.length} comparable measurements.${criterionStatusSentence(
          meaning
        )}`,
        classification: "inference",
        evidenceStrength:
          !criterionResolved || lowData
            ? "low"
            : sources.length >= 5 && providerRoles.size >= 2
            ? "high"
            : "medium",
        limitations,
        sources,
        measurement: meaning,
        contributor: contributorForGoalSeries(seriesGroup[0]),
      })
    );
  }

  return [...findings, ...caregiverContextPatternFindings(context)];
}

function caregiverContextPatternFindings(
  context: InsightContext
): InsightFinding[] {
  const caregiverRecords = context.documentationRecords.filter(
    (record) =>
      record.providerRole === "Caregiver" &&
      ["MorningContext", "EveningContext"].includes(record.kind) &&
      record.status === "COMPLETED"
  );
  const recordsByProvider = new Map<string, DocumentationRecord[]>();
  for (const record of caregiverRecords) {
    const existing = recordsByProvider.get(record.providerId) ?? [];
    existing.push(record);
    recordsByProvider.set(record.providerId, existing);
  }

  const findings: InsightFinding[] = [];
  for (const records of recordsByProvider.values()) {
    const selections = new Map<
      string,
      Array<{ record: DocumentationRecord; label: string; value: string }>
    >();
    for (const record of records) {
      for (const entry of caregiverContextEntries(record.contextData)) {
        const existing = selections.get(entry.key) ?? [];
        existing.push({ record, label: entry.label, value: entry.value });
        selections.set(entry.key, existing);
      }
    }

    const supported = [...selections.entries()]
      .filter(([, entries]) => entries.length >= 3)
      .sort(
        ([leftKey, left], [rightKey, right]) =>
          caregiverContextPriority(leftKey) - caregiverContextPriority(rightKey) ||
          right.length - left.length
      )
      .slice(0, MAX_CAREGIVER_CONTEXT_FINDINGS_PER_CONTRIBUTOR);

    for (const [key, entries] of supported) {
      const latest = [...entries].sort(
        (left, right) => recordTime(right.record) - recordTime(left.record)
      )[0];
      const counts = valueCounts(entries.map((entry) => entry.value));
      const subject = latest.label || humanize(key);
      const statement =
        key === "medication"
          ? medicationContextStatement(entries.length, counts)
          : caregiverSelectionStatement(subject, entries.length, counts);
      findings.push(
        finding("patterns", `caregiver-${key}`, {
          title: subject,
          statement,
          classification: "observation",
          evidenceStrength: entries.length >= 5 ? "medium" : "low",
          limitations: [],
          sources: entries.map(({ record }) => documentationSource(record)),
          supportingRecordCount: new Set(entries.map(({ record }) => record.id)).size,
          contributor: {
            providerId: latest.record.providerId,
            displayName: latest.record.providerName,
            role: latest.record.providerRole,
            kind: "caregiverContext",
          },
        })
      );
    }
  }
  return findings;
}

function caregiverContextEntries(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const entries = (value as { entries?: unknown }).entries;
  if (!Array.isArray(entries)) return [];
  return entries.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    if (
      typeof candidate.key !== "string" ||
      typeof candidate.value !== "string" ||
      !candidate.value.trim()
    ) {
      return [];
    }
    return [
      {
        key: candidate.key,
        label:
          typeof candidate.label === "string"
            ? candidate.label.trim()
            : humanize(candidate.key),
        value: candidate.value.trim(),
      },
    ];
  });
}

function valueCounts(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount || leftValue.localeCompare(rightValue)
  );
}

function caregiverSelectionStatement(
  subject: string,
  recordCount: number,
  counts: Array<[string, number]>
) {
  const [mostFrequent, count] = counts[0];
  const tied = counts.filter(([, valueCount]) => valueCount === count).length > 1;
  return tied
    ? `Across ${recordCount} completed caregiver contexts, ${subject.toLowerCase()} had no single most frequently recorded response.`
    : `Across ${recordCount} completed caregiver contexts, ${subject.toLowerCase()} was most often recorded as ${mostFrequent} (${count} records).`;
}

function medicationContextStatement(
  recordCount: number,
  counts: Array<[string, number]>
) {
  const distribution = counts
    .map(([value, count]) => `${value.toLowerCase()} in ${count}`)
    .join(", ");
  return `Across ${recordCount} completed caregiver contexts, prescribed medication was recorded as ${distribution}. This private context is shown without linking it to provider observations or client outcomes.`;
}

function caregiverContextPriority(key: string) {
  return ["medication", "sleep", "schoolTransition", "overallEvening", "homeRoutine", "breakfast"].indexOf(key) + 1 || 99;
}

function contributorForGoalSeries(
  series: GoalSeries
): NonNullable<InsightFinding["contributor"]> {
  return {
    providerId: series.providerId,
    displayName: series.providerName,
    role: series.providerRole,
    kind: "provider",
  };
}

function associatedContextFindings(context: InsightContext): InsightFinding[] {
  const findings: InsightFinding[] = [];

  if (context.currentTeamFocus) {
    const focusTitle = safeFindingSubject(
      context.currentTeamFocus.title ?? "Untitled focus"
    );
    findings.push(
      finding("context", "team-focus-present", {
        title: "Current Team Focus",
        statement: `Team Focus “${focusTitle}” was recorded and last updated on ${dateLabel(
          context.currentTeamFocus.updatedAt
        )}.`,
        classification: "observation",
        evidenceStrength: "medium",
        limitations: [],
        sources: [teamFocusSource(context.currentTeamFocus)],
      })
    );
  }

  const settings = new Map<string, InsightContext["fieldObservations"]>();
  for (const observation of context.fieldObservations) {
    const records = settings.get(observation.setting) ?? [];
    records.push(observation);
    settings.set(observation.setting, records);
  }
  const repeatedSetting = [...settings.entries()]
    .filter(([, records]) => records.length >= 2)
    .sort((left, right) => right[1].length - left[1].length)[0];
  if (repeatedSetting) {
    findings.push(
      finding("context", "repeated-setting", {
        title: "Documented service setting",
        statement: `${repeatedSetting[1].length} Field Observations were recorded in ${humanize(
          repeatedSetting[0]
        ).toLowerCase()}.`,
        classification: "observation",
        evidenceStrength: repeatedSetting[1].length >= 3 ? "high" : "medium",
        limitations: [],
        sources: repeatedSetting[1].map(fieldObservationSource),
      })
    );
  }

  const latestRequest = [...context.caseSupport.requests].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  )[0];
  const latestCase = [...context.caseSupport.cases].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  )[0];
  if (latestCase || latestRequest) {
    const source = latestCase
      ? caseSupportCaseSource(latestCase)
      : caseSupportRequestSource(latestRequest);
    const status = latestCase?.status ?? latestRequest.status;
    findings.push(
      finding("context", "case-support-status", {
        title: "Accessible Case Support context",
        statement: `The latest accessible Case Support ${latestCase ? "case" : "request"} was ${humanize(
          status
        ).toLowerCase()} on ${dateLabel(
          latestCase?.updatedAt ?? latestRequest.updatedAt
        )}.`,
        classification: "observation",
        evidenceStrength: "medium",
        limitations: [],
        sources: [source],
      })
    );
  }

  return findings;
}

function confidenceFindings(
  context: InsightContext,
  patterns: InsightFinding[]
): InsightFinding[] {
  const recordSources = allRecordSources(context);
  if (recordSources.length === 0) return [];

  const findings: InsightFinding[] = [];
  const roles = new Set(
    [
      ...context.documentationRecords.map((record) => record.providerRole),
      ...context.fieldObservations.map(
        (observation) => observation.observedProvider.role
      ),
    ].filter(Boolean)
  );
  const recordCount = recordSources.length;
  const measurementLimitations = structuredMeasurementLimitations(
    context,
    patterns
  );
  const limited =
    recordCount < 3 || roles.size < 2 || measurementLimitations.hasMaterialLimit;
  findings.push(
    finding("confidence", "record-coverage", {
      title: "Evidence coverage",
      statement: `${recordCount} completed documentation or Field Observation record${
        recordCount === 1 ? " is" : "s are"
      } available across ${roles.size} documented provider role${roles.size === 1 ? "" : "s"}.`,
      classification: "observation",
      evidenceStrength: limited ? "low" : roles.size >= 3 && recordCount >= 6 ? "high" : "medium",
      limitations: limited
        ? ["Record volume or provider-role coverage is limited."]
        : [],
      sources: recordSources,
    })
  );

  if (measurementLimitations.sources.length) {
    findings.push(
      finding("confidence", "measurement-configuration", {
        title: "Structured measurement limitations",
        statement: measurementLimitations.statement,
        classification: "observation",
        evidenceStrength: measurementLimitations.hasMaterialLimit
          ? "low"
          : "medium",
        limitations: measurementLimitations.limitations,
        sources: measurementLimitations.sources,
      })
    );
  }

  const ambiguousRecords = context.documentationRecords.filter(
    documentationIsAmbiguous
  );
  if (ambiguousRecords.length) {
    findings.push(
      finding("confidence", "ambiguous-documentation", {
        title: "Documentation clarity limitation",
        statement: `${ambiguousRecords.length} accessible record${
          ambiguousRecords.length === 1 ? " contains" : "s contain"
        } wording with unclear meaning, timing, or attribution.`,
        classification: "observation",
        evidenceStrength: "low",
        limitations: [
          "Unclear wording is not interpreted beyond what the original record states.",
        ],
        sources: ambiguousRecords.map(documentationSource),
      })
    );
  }

  return findings;
}

function significanceFindings(context: InsightContext): InsightFinding[] {
  const findings: InsightFinding[] = [];
  const eligible = context.providerGoalSeries.filter(
    (series) => uniqueMeasurementSessions(series).length >= 3
  );

  for (const series of eligible) {
    if (findings.length >= MAX_FINDINGS_PER_LENS) break;
    const transition = criterionTransition(series);
    if (!transition) continue;
    const sources = sourcesForSelectedSessions(
      series,
      transition.sessions,
      context
    );
    findings.push(
      finding("significance", `criterion-transition-${series.providerId}-${series.goalKey}`, {
        title: "Configured criterion transition",
        statement: `The latest ${transition.qualifyingCount} completed session${
          transition.qualifyingCount === 1 ? "" : "s"
        } met the configured criterion after an earlier completed session did not.`,
        classification: "observation",
        evidenceStrength: transition.qualifyingCount >= 3 ? "high" : "medium",
        limitations: [],
        sources,
      })
    );
  }

  for (const seriesGroup of groupCompatibleCrossProviderSeries(eligible)) {
    if (findings.length >= MAX_FINDINGS_PER_LENS) break;
    const providerRoles = new Set(
      seriesGroup.map((series) => series.providerRole).filter(Boolean)
    );
    if (providerRoles.size < 2) continue;
    const directions = new Set(
      seriesGroup.map((series) => series.measurementTrend).filter(Boolean)
    );
    if (directions.size === 0) continue;
    const sources = sourcesForSeries(seriesGroup, context);
    if (sources.length === 0) continue;
    const differentDirections = directions.size > 1;
    findings.push(
      finding("significance", differentDirections ? "cross-provider-difference" : "cross-provider-agreement", {
        title: differentDirections
          ? "Different directions across compatible provider series"
          : "Same direction across compatible provider series",
        statement: differentDirections
          ? "Compatible provider series show different recorded directions, so one client-wide direction is not supported."
          : `The same recorded direction appears in separate compatible series from ${numberWord(
              providerRoles.size
            )} provider roles.`,
        classification: "inference",
        evidenceStrength: differentDirections ? "low" : "high",
        limitations: [],
        sources,
      })
    );
  }

  return findings;
}

function criterionTransition(series: GoalSeries) {
  if (!hasValidCriterion(series)) return null;
  const sessions = uniqueCriterionSessions(series)
    .filter((session) => session.status === "COMPLETED")
    .sort((left, right) => Date.parse(left.date) - Date.parse(right.date));
  const statuses = sessions.map((session) => ({
    session,
    status: evaluateNativeCriterion({
      metricType: series.metricType,
      rawValue: session.rawValue,
      score: session.score,
      targetValue: series.targetValue,
      comparison: series.comparison,
      configuredMetricType: series.metricType,
      metadataConsistent: series.metadataConsistent,
    }),
  }));
  let streakStart = statuses.length;
  while (streakStart > 0 && statuses[streakStart - 1].status === "met") {
    streakStart -= 1;
  }
  if (
    streakStart === statuses.length ||
    streakStart === 0 ||
    statuses[streakStart - 1].status !== "notMet"
  ) {
    return null;
  }
  const qualifying = statuses.slice(streakStart);
  return {
    qualifyingCount: qualifying.length,
    sessions: [
      statuses[streakStart - 1].session,
      ...qualifying.map((item) => item.session),
    ],
  };
}

function groupCompatibleCrossProviderSeries(series: GoalSeries[]) {
  const groups: GoalSeries[][] = [];
  for (const item of series) {
    if (!isCrossProviderComparable(item)) continue;
    const group = groups.find((candidate) =>
      candidate.some(
        (existing) =>
          defensibleGoalMatch(existing, item) &&
          crossProviderMeasurementCompatible(existing, item)
      )
    );
    if (group) group.push(item);
    else groups.push([item]);
  }
  return groups.filter(
    (group) => new Set(group.map((item) => item.providerId)).size >= 2
  );
}

function isCrossProviderComparable(series: GoalSeries) {
  return (
    series.metricType !== "Subjective" &&
    hasValidCriterion(series) &&
    Boolean(series.measurementTrend)
  );
}

function defensibleGoalMatch(left: GoalSeries, right: GoalSeries) {
  const sameGoalId =
    Boolean(left.goalId) && Boolean(right.goalId) && left.goalId === right.goalId;
  const exactTextMatch =
    normalizeText(left.target).length > 0 &&
    normalizeText(left.goal).length > 0 &&
    normalizeText(left.target) === normalizeText(right.target) &&
    normalizeText(left.goal) === normalizeText(right.goal);
  return sameGoalId || exactTextMatch;
}

function crossProviderMeasurementCompatible(left: GoalSeries, right: GoalSeries) {
  return (
    left.providerId !== right.providerId &&
    left.metricType === right.metricType &&
    left.measurementValueBasis === right.measurementValueBasis &&
    (left.measurementProfile ?? null) === (right.measurementProfile ?? null) &&
    left.targetValue === right.targetValue &&
    left.comparison === right.comparison
  );
}

function finding(
  lens: InsightLens,
  rule: string,
  input: Omit<InsightFinding, "id" | "supportingRecordCount"> & {
    supportingRecordCount?: number;
  }
): InsightFinding {
  const allSources = uniqueSources(input.sources);
  const sources = allSources.slice(0, MAX_SOURCES_PER_FINDING);
  return {
    id: `${lens}-${slug(rule)}-${stableHash(
      allSources.map((source) => `${source.recordType}:${source.recordId}`).sort().join("|")
    )}`,
    ...input,
    sources,
    supportingRecordCount:
      input.supportingRecordCount ?? allSources.length,
  };
}

function documentationSource(record: DocumentationRecord): InsightSource {
  return source({
    recordType: "entry",
    recordId: record.id,
    label: `${humanize(record.kind)} documentation`,
    occurredAt: record.completedAt ?? record.date,
    provider: {
      id: record.providerId,
      displayName: record.providerName,
      role: record.providerRole,
    },
    excerpt: safeExcerpt(
      record.observations[0]?.observation ??
        record.clinicalReflection ??
        record.note
    ),
  });
}

function fieldObservationSource(
  observation: InsightContext["fieldObservations"][number]
): InsightSource {
  return source({
    recordType: "fieldObservation",
    recordId: observation.id,
    label: "Field Observation",
    occurredAt: observation.observedAt,
    provider: {
      id: observation.observedProvider.id,
      displayName: observation.observedProvider.name,
      role: observation.observedProvider.role,
    },
    excerpt: safeExcerpt(
      `Setting: ${humanize(observation.setting)}; ${observation.applicableItemCount} applicable rubric items documented.`
    ),
  });
}

function teamFocusSource(
  focus: NonNullable<InsightContext["currentTeamFocus"]>
): InsightSource {
  return source({
    recordType: "teamFocus",
    recordId: focus.id,
    label: "Current Team Focus",
    occurredAt: focus.updatedAt,
  });
}

function caseSupportRequestSource(
  request: InsightContext["caseSupport"]["requests"][number]
): InsightSource {
  return source({
    recordType: "caseSupportRequest",
    recordId: request.id,
    label: "Case Support request",
    occurredAt: request.updatedAt,
    excerpt: safeExcerpt(`Status: ${humanize(request.status)}. ${request.concern}`),
  });
}

function caseSupportCaseSource(
  caseRecord: InsightContext["caseSupport"]["cases"][number]
): InsightSource {
  return source({
    recordType: "caseSupportCase",
    recordId: caseRecord.id,
    label: "Case Support case",
    occurredAt: caseRecord.updatedAt,
    excerpt: safeExcerpt(`Status: ${humanize(caseRecord.status)}. ${caseRecord.concern}`),
  });
}

function caseSupportEntrySource(
  entry: InsightContext["caseSupport"]["cases"][number]["entries"][number]
): InsightSource {
  return source({
    recordType: "caseSupportEntry",
    recordId: entry.id,
    label: "Case Support entry",
    occurredAt: entry.occurredAt,
    excerpt: safeExcerpt(entry.whatOccurred),
  });
}

function source(input: {
  recordType: InsightSourceRecordType;
  recordId: string;
  label: string;
  occurredAt?: string;
  provider?: InsightSource["provider"];
  excerpt?: string;
}): InsightSource {
  const id = `${input.recordType}:${input.recordId}`;
  return {
    id,
    recordType: input.recordType,
    recordId: input.recordId,
    label: input.label,
    ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.excerpt ? { excerpt: input.excerpt } : {}),
  };
}

function sourcesForSeries(
  seriesGroup: GoalSeries[],
  context: InsightContext
): InsightSource[] {
  return uniqueSources(
    seriesGroup.flatMap((series) =>
      sourcesForSelectedSessions(
        series,
        uniqueMeasurementSessions(series),
        context
      )
    )
  );
}

function sourcesForSelectedSessions(
  series: GoalSeries,
  sessions: GoalSeries["sessions"],
  context: InsightContext
): InsightSource[] {
  const careTeamById = new Map(
    context.careTeam.map((provider) => [provider.providerId, provider])
  );
  return uniqueSources(
    sessions.map((session) => {
      const provider = careTeamById.get(series.providerId);
      return source({
        recordType: "entry",
        recordId: session.sessionId,
        label: `${series.target} ${sourceMetricLabel(
          series.metricType
        )} measurement`,
        occurredAt: session.date,
        provider: provider
          ? {
              id: provider.providerId,
              displayName: provider.providerName,
              role: provider.assignmentRole || provider.accountRole,
            }
          : {
              id: series.providerId,
              displayName: series.providerName,
              role: series.providerRole,
            },
        excerpt:
          session.measurementValue === null
            ? undefined
            : safeExcerpt(
                `${series.target}: recorded ${formatMeasurementValue(
                  session.measurementValue,
                  series.metricType
                )}.`
              ),
      });
    })
  );
}

function measurementMeaning(seriesGroup: GoalSeries[]): InsightMeasurementMeaning {
  const first = seriesGroup[0];
  const direction = combinedDirection(
    seriesGroup.map((series) => series.measurementTrend)
  );
  const normalizedDirection = combinedDirection(
    seriesGroup.map((series) => series.normalizedTrend)
  );
  const validCriterion = seriesGroup.every(hasValidCriterion);
  const relationships = validCriterion
    ? seriesGroup
        .filter((series) => Boolean(series.measurementTrend))
        .map((series) => goalRelationshipForSeries(series))
    : ["unknown" as InsightGoalRelationship];
  const goalRelationship = combineGoalRelationships(relationships, direction);

  return {
    metricType: first.metricType,
    valueBasis: first.measurementValueBasis,
    direction,
    normalizedDirection,
    goalRelationship,
    ...(validCriterion && first.targetValue !== null
      ? { targetValue: first.targetValue }
      : {}),
    ...(validCriterion && first.comparison
      ? { comparison: first.comparison }
      : {}),
    ...(unitLabel(first.metricType)
      ? { unitLabel: unitLabel(first.metricType) }
      : {}),
    masteryReady: masteryReadyMeasurement(first, direction),
  };
}

function masteryReadyMeasurement(
  series: GoalSeries,
  direction: InsightMeasurementDirection
): InsightMeasurementMeaning["masteryReady"] {
  const sessions = uniqueCriterionSessions(series);
  const criterionStatuses = sessions.map((session) =>
    evaluateNativeCriterion({
      metricType: series.metricType,
      rawValue: session.rawValue,
      score: session.score,
      targetValue: series.targetValue,
      comparison: series.comparison,
      configuredMetricType: series.metricType,
      metadataConsistent: series.metadataConsistent,
    })
  );
  const criterionStatus = combinedCriterionStatus(criterionStatuses);
  const configurationKey = measurementConfigurationKey(series);
  const streak = calculateCriterionStreak(
    sessions.map((session) => ({
      entryId: session.sessionId,
      occurredAt: session.date,
      status: session.status,
      completedAt: session.completedAt,
      providerId: series.providerId,
      goalKey: series.goalKey,
      configurationKey,
      metricType: series.metricType,
      rawValue: session.rawValue,
      score: session.score,
      targetValue: series.targetValue,
      comparison: series.comparison,
      configuredMetricType: series.metricType,
      metadataConsistent: series.metadataConsistent,
    }))
  );
  const candidate = evaluateMasteryCandidate({
    providerId: series.providerId,
    goalId: series.goalId ?? series.goalKey,
    metricType: series.metricType as MasteryCandidateMetricType,
    percentageMasteryThreshold: series.masteryThreshold,
    targetValue: series.targetValue,
    comparison: series.comparison,
    requiredConsecutiveSessions: series.masteryRequiredSessions,
    metadataConsistent: series.metadataConsistent,
    sessions: sessions.map((session) => ({
      entryId: session.sessionId,
      occurredAt: session.date,
      completedAt: session.completedAt,
      status: session.status,
      providerId: series.providerId,
      goalId: series.goalId ?? series.goalKey,
      metricType: series.metricType as MasteryCandidateMetricType,
      rawValue: session.rawValue,
      score: session.score,
      configuration: {
        percentageMasteryThreshold: series.masteryThreshold,
        targetValue: series.targetValue,
        comparison: series.comparison,
        configuredMetricType:
          series.metricType as MasteryCandidateMetricType,
        metadataConsistent: series.metadataConsistent,
      },
    })),
  });
  const policyMastered = series.masteryBasis === "POLICY_V1";

  return {
    measurementDirection:
      direction === "increasing"
        ? "increased"
        : direction === "decreasing"
          ? "decreased"
          : direction === "stable"
            ? "stable"
            : "mixed",
    criterionStatus,
    consecutiveCriterionSessions: streak.consecutiveCriterionSessions,
    criterionSourceRecordIds: streak.criterionSourceRecordIds,
    masteryRuleStatus: candidate.ruleStatus,
    requiredConsecutiveCriterionSessions:
      candidate.requiredConsecutiveSessions,
    masteryCandidate:
      candidate.status === "unknown"
        ? null
        : candidate.status === "candidate",
    masteryStatus: policyMastered
      ? "confirmed"
      : series.legacyIsMastered
        ? "unknown"
        : "notConfirmed",
    promptOrIndependenceStatus: promptOrIndependenceStatus(series),
    maintenanceStatus: "unknown",
    generalizationStatus: "unknown",
    goalLifecycle: policyMastered
      ? "policyMastered"
      : series.masteryRevokedAt && series.goalIsActive === true
        ? "reopenedAfterCorrection"
        : series.legacyIsMastered
          ? "legacySystemMarkedMastered"
          : series.goalIsActive === true
            ? "active"
            : series.goalIsActive === false
              ? "inactive"
              : "unknown",
  };
}

function combinedCriterionStatus(
  statuses: NativeCriterionStatus[]
): InsightMeasurementMeaning["masteryReady"]["criterionStatus"] {
  if (statuses.length === 0 || statuses.includes("unknown")) return "unknown";
  const distinct = new Set(statuses);
  if (distinct.size > 1) return "mixed";
  return statuses[0];
}

function promptOrIndependenceStatus(
  series: GoalSeries
): InsightMeasurementMeaning["masteryReady"]["promptOrIndependenceStatus"] {
  if (!series.measurementProfile) return "notApplicable";
  if (
    [
      "PromptLevel",
      "CueLevel",
      "CueingLevel",
      "AssistanceLevel",
      "SupportLevel",
      "Independence",
    ].includes(series.measurementProfile)
  ) {
    // Active and legacy forms use conflicting ordinal orientations. Until a
    // series carries authoritative bounds, direction, and labels, a profile
    // name or score cannot safely establish prompting or independence status.
    return "unknown";
  }
  return "notApplicable";
}

function combinedDirection(
  trends: Array<GoalSeries["measurementTrend"]>
): InsightMeasurementDirection {
  const available = new Set(trends.filter(Boolean));
  if (available.size === 0) return "insufficient";
  if (available.size > 1) return "mixed";
  const trend = [...available][0];
  if (trend === "up") return "increasing";
  if (trend === "down") return "decreasing";
  return "stable";
}

function goalRelationshipForSeries(
  series: GoalSeries
): InsightGoalRelationship {
  if (!hasValidCriterion(series)) return "unknown";
  const direction = combinedDirection([series.measurementTrend]);
  if (direction === "insufficient") return "unknown";
  if (direction === "mixed") return "mixed";

  if (series.comparison === "LessThan") {
    if (direction === "decreasing") return "towardCriterion";
    if (direction === "increasing") return "awayFromCriterion";
    return isWithinCriterion(
      series.measurementSecondAverage,
      series.targetValue,
      series.comparison
    )
      ? "nearCriterion"
      : "unknown";
  }
  if (series.comparison === "GreaterThan") {
    if (direction === "increasing") return "towardCriterion";
    if (direction === "decreasing") return "awayFromCriterion";
    return isWithinCriterion(
      series.measurementSecondAverage,
      series.targetValue,
      series.comparison
    )
      ? "nearCriterion"
      : "unknown";
  }

  if (
    series.measurementFirstAverage === null ||
    series.measurementSecondAverage === null ||
    series.targetValue === null
  ) {
    return "unknown";
  }
  const firstDistance = Math.abs(
    series.measurementFirstAverage - series.targetValue
  );
  const secondDistance = Math.abs(
    series.measurementSecondAverage - series.targetValue
  );
  if (secondDistance < firstDistance) return "towardCriterion";
  if (secondDistance > firstDistance) return "awayFromCriterion";
  return isAtCriterion(series.measurementSecondAverage, series.targetValue)
    ? "nearCriterion"
    : "unknown";
}

function combineGoalRelationships(
  relationships: InsightGoalRelationship[],
  direction: InsightMeasurementDirection
): InsightGoalRelationship {
  if (direction === "mixed") return "mixed";
  const available = new Set(relationships);
  if (available.size === 0) return "unknown";
  if (available.size > 1) return "mixed";
  return [...available][0];
}

function criterionStatusSentence(meaning: InsightMeasurementMeaning) {
  const count = meaning.masteryReady.consecutiveCriterionSessions;
  if (count > 0) {
    return ` The configured session criterion was met in the latest ${count} completed session${
      count === 1 ? "" : "s"
    }.`;
  }
  if (meaning.masteryReady.criterionStatus === "notMet") {
    return " The configured session criterion was not met in the latest completed session.";
  }
  return "";
}

function structuredMeasurementLimitations(
  context: InsightContext,
  patterns: InsightFinding[]
) {
  const seriesWithRecords = context.providerGoalSeries.filter(
    (series) => uniqueMeasurementSessions(series).length > 0
  );
  const sources = sourcesForSeries(seriesWithRecords, context);
  const missingConfiguration = seriesWithRecords.some(
    (series) => !hasValidCriterion(series)
  );
  const incompatibleConfiguration = hasIncompatibleConfigurations(
    seriesWithRecords
  );
  const lowData = seriesWithRecords.some((series) =>
    series.sessions.some((session) => session.lowData)
  );
  const contradictory = patterns.some(
    (pattern) => pattern.measurement?.direction === "mixed"
  );
  const longestCriterionStreak = Math.max(
    0,
    ...seriesWithRecords.map(
      (series) =>
        masteryReadyMeasurement(
          series,
          combinedDirection([series.measurementTrend])
        ).consecutiveCriterionSessions
    )
  );
  const limitations = [
    ...(missingConfiguration
      ? ["The measurement direction is supported, but no valid session criterion is configured for one or more series."]
      : []),
    ...(incompatibleConfiguration
      ? ["Series with incompatible metric or criterion definitions were not combined."]
      : []),
    ...(lowData ? ["One or more measurement series are marked as low data."] : []),
    ...(contradictory
      ? ["Comparable structured series show different native measurement directions."]
      : []),
    ...(longestCriterionStreak > 0
      ? [`${longestCriterionStreak} consecutive completed session${
          longestCriterionStreak === 1 ? "" : "s"
        } met a configured goal criterion; a separate mastery rule is not configured.`]
      : []),
  ];
  const hasMaterialLimit = limitations.length > 0;
  return {
    sources,
    hasMaterialLimit,
    limitations,
    statement: hasMaterialLimit
      ? `${sources.length} unique structured measurement record${
          sources.length === 1 ? " has" : "s have"
        } configuration, coverage, or agreement limitations.`
      : `${sources.length} unique structured measurement record${
          sources.length === 1 ? " uses" : "s use"
        } compatible metric and goal definitions.`,
  };
}

function hasIncompatibleConfigurations(series: GoalSeries[]) {
  const configurationsByIdentity = new Map<string, Set<string>>();
  for (const item of series) {
    const identity = baseGoalIdentity(item);
    const configurations = configurationsByIdentity.get(identity) ?? new Set();
    configurations.add(measurementConfigurationKey(item));
    configurationsByIdentity.set(identity, configurations);
  }
  return [...configurationsByIdentity.values()].some(
    (configurations) => configurations.size > 1
  );
}

function hasValidCriterion(series: GoalSeries) {
  return (
    series.metadataConsistent &&
    typeof series.targetValue === "number" &&
    Number.isFinite(series.targetValue) &&
    (series.comparison === "LessThan" ||
      series.comparison === "GreaterThan" ||
      series.comparison === "Equal")
  );
}

function measurementConfigurationKey(series: GoalSeries) {
  if (!series.metadataConsistent) {
    return `${series.metricType}|inconsistent:${series.providerId}:${series.goalKey}`;
  }
  const criterion = hasValidCriterion(series)
    ? `${series.comparison}:${series.targetValue}`
    : "criterion:unknown";
  return `${series.metricType}|${series.measurementValueBasis}|${criterion}`;
}

function baseGoalIdentity(series: GoalSeries) {
  return series.goalId
    ? `goal:${series.goalId}`
    : `text:${normalizeText(series.target)}:${normalizeText(series.goal)}`;
}

function uniqueMeasurementSessions(series: GoalSeries) {
  return series.sessions.filter(
    (session, index, sessions) =>
      session.valueBasis === series.measurementValueBasis &&
      typeof session.measurementValue === "number" &&
      Number.isFinite(session.measurementValue) &&
      sessions.findIndex(
        (candidate) => candidate.sessionId === session.sessionId
      ) === index
  );
}

function uniqueCriterionSessions(series: GoalSeries) {
  return series.sessions.filter(
    (session, index, sessions) =>
      session.valueBasis === series.measurementValueBasis &&
      sessions.findIndex(
        (candidate) => candidate.sessionId === session.sessionId
      ) === index
  );
}

function directionPhrase(direction: InsightMeasurementDirection) {
  if (direction === "increasing") return "increased";
  if (direction === "decreasing") return "decreased";
  return "remained stable";
}

function metricLabel(metricType: string) {
  if (metricType === "Subjective") return "ratings";
  return humanize(metricType).toLowerCase();
}

function sourceMetricLabel(metricType: string) {
  return metricType === "Subjective" ? "rating" : metricLabel(metricType);
}

function measurementValuesLabel(metricType: string) {
  return metricType === "Subjective"
    ? "ratings"
    : `${metricLabel(metricType)} values`;
}

function unitLabel(metricType: string) {
  if (metricType === "Percentage") return "%";
  if (metricType === "Frequency") return "count";
  if (metricType === "Subjective") return "rating";
  return undefined;
}

function formatMeasurementValue(value: number, metricType: string) {
  if (metricType === "Percentage") return `${formatNumber(value)}%`;
  if (metricType === "Subjective") return `rating ${formatNumber(value)}`;
  return formatNumber(value);
}

function formatNumber(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "the target value";
  return Number.isInteger(value) ? `${value}` : `${Math.round(value * 100) / 100}`;
}

function isAtCriterion(value: number | null, target: number | null) {
  return value !== null && target !== null && Math.abs(value - target) < 1e-9;
}

function isWithinCriterion(
  value: number | null,
  target: number | null,
  comparison: GoalSeries["comparison"]
) {
  if (value === null || target === null) return false;
  if (comparison === "LessThan") return value < target;
  if (comparison === "GreaterThan") return value > target;
  return isAtCriterion(value, target);
}

function measurementHasValidCriterion(meaning: InsightMeasurementMeaning) {
  return (
    typeof meaning.targetValue === "number" &&
    Number.isFinite(meaning.targetValue) &&
    Boolean(meaning.comparison)
  );
}

function allRecordSources(context: InsightContext): InsightSource[] {
  return uniqueSources([
    ...context.documentationRecords.map(documentationSource),
    ...context.fieldObservations.map(fieldObservationSource),
  ]).sort(
    (left, right) =>
      Date.parse(right.occurredAt ?? "1970-01-01") -
      Date.parse(left.occurredAt ?? "1970-01-01")
  );
}

function groupGoalSeries(series: GoalSeries[]) {
  const groups = new Map<string, GoalSeries[]>();
  for (const item of series) {
    const identity = baseGoalIdentity(item);
    const metadata = measurementConfigurationKey(item);
    const key = `${item.providerId}|${identity}|${metadata}`;
    const values = groups.get(key) ?? [];
    values.push(item);
    groups.set(key, values);
  }
  return [...groups.values()].sort((left, right) => {
    const leftLatest = Math.max(...left.flatMap((item) => item.sessions.map((session) => Date.parse(session.date))));
    const rightLatest = Math.max(...right.flatMap((item) => item.sessions.map((session) => Date.parse(session.date))));
    return rightLatest - leftLatest;
  });
}

function documentationIsAmbiguous(record: DocumentationRecord) {
  const text = [
    record.note,
    record.clinicalReflection,
    ...record.observations.map((observation) => observation.observation),
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return text.length === 0 || text.length < 20 || AMBIGUOUS_LANGUAGE.test(text);
}

function safeExcerpt(value: string | null | undefined) {
  const text = (value ?? "").replace(/\s+/g, " ").trim();
  if (!text || PROHIBITED_EXCERPT_LANGUAGE.test(text)) return undefined;
  return text.length <= 180 ? text : `${text.slice(0, 177).trimEnd()}…`;
}

function safeFindingSubject(value: string) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text || PROHIBITED_EXCERPT_LANGUAGE.test(text)) return "a tracked target";
  return text.length <= 80 ? text : `${text.slice(0, 77).trimEnd()}…`;
}

function uniqueSources(sources: InsightSource[]) {
  return sources.filter(
    (item, index, values) =>
      item.recordId.trim().length > 0 &&
      values.findIndex(
        (candidate) =>
          candidate.recordType === item.recordType &&
          candidate.recordId === item.recordId
      ) === index
  );
}

function latestContextTimestamp(context: InsightContext) {
  const timestamps = [
    ...context.documentationRecords.flatMap((record) => [
      record.completedAt,
      record.updatedAt,
      record.date,
    ]),
    ...context.fieldObservations.map((observation) => observation.observedAt),
    context.currentTeamFocus?.updatedAt,
    ...context.caseSupport.requests.map((request) => request.updatedAt),
    ...context.caseSupport.cases.map((caseRecord) => caseRecord.updatedAt),
  ]
    .filter((value): value is string => Boolean(value))
    .map(Date.parse)
    .filter(Number.isFinite);
  return timestamps.length
    ? new Date(Math.max(...timestamps)).toISOString()
    : "1970-01-01T00:00:00.000Z";
}

function recordTime(record: DocumentationRecord) {
  return Date.parse(record.completedAt ?? record.updatedAt ?? record.date);
}

function dateLabel(value: string) {
  return value.slice(0, 10);
}

function numberWord(value: number) {
  if (value === 2) return "two";
  if (value === 3) return "three";
  return `${value}`;
}

function humanize(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slug(value: string) {
  return normalizeText(value).replace(/\s+/g, "-").slice(0, 48) || "finding";
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
