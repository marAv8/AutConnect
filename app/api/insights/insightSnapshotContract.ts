import type { InsightLens } from "../../libs/insights/lenses";

export type InsightSourceRecordType =
  | "entry"
  | "entryRevision"
  | "assessmentItem"
  | "abcObservation"
  | "fieldObservation"
  | "teamFocus"
  | "caseSupportRequest"
  | "caseSupportCase"
  | "caseSupportEntry";

export type InsightSource = {
  id: string;
  recordType: InsightSourceRecordType;
  recordId: string;
  label: string;
  occurredAt?: string;
  provider?: {
    id: string;
    displayName: string;
    role: string;
  };
  excerpt?: string;
};

export type InsightMeasurementDirection =
  | "increasing"
  | "decreasing"
  | "stable"
  | "mixed"
  | "insufficient";

export type InsightMeasurementValueBasis = "rawValue" | "score";

export type InsightGoalRelationship =
  | "towardCriterion"
  | "awayFromCriterion"
  | "nearCriterion"
  | "mixed"
  | "unknown";

export type InsightMeasurementMeaning = {
  metricType: string;
  valueBasis: InsightMeasurementValueBasis;
  direction: InsightMeasurementDirection;
  normalizedDirection?: InsightMeasurementDirection;
  goalRelationship: InsightGoalRelationship;
  targetValue?: number;
  comparison?: "LessThan" | "GreaterThan" | "Equal";
  unitLabel?: string;
  masteryReady: InsightMasteryReadyMeasurement;
};

export type InsightCriterionStatus = "met" | "notMet" | "mixed" | "unknown";
export type InsightMasteryRuleStatus = "configured" | "missing" | "inconsistent";
export type InsightMasteryStatus = "confirmed" | "notConfirmed" | "unknown";

export type InsightMasteryReadyMeasurement = {
  measurementDirection: "increased" | "decreased" | "stable" | "mixed";
  criterionStatus: InsightCriterionStatus;
  consecutiveCriterionSessions: number;
  criterionSourceRecordIds: string[];
  masteryRuleStatus: InsightMasteryRuleStatus;
  requiredConsecutiveCriterionSessions?: number;
  masteryCandidate: boolean | null;
  masteryStatus: InsightMasteryStatus;
  promptOrIndependenceStatus:
    | "independent"
    | "partiallyIndependent"
    | "prompted"
    | "notApplicable"
    | "unknown";
  maintenanceStatus: "supported" | "notSupported" | "unknown";
  generalizationStatus: "supported" | "notSupported" | "unknown";
  goalLifecycle:
    | "active"
    | "inactive"
    | "policyMastered"
    | "reopenedAfterCorrection"
    | "legacySystemMarkedMastered"
    | "unknown";
};

export type InsightFinding = {
  id: string;
  title: string;
  statement: string;
  classification: "observation" | "inference";
  evidenceStrength: "high" | "medium" | "low";
  limitations: string[];
  sources: InsightSource[];
  supportingRecordCount: number;
  measurement?: InsightMeasurementMeaning;
  contributor?: {
    providerId: string;
    displayName: string;
    role: string;
    kind: "provider" | "caregiverContext";
  };
};

export type InsightSnapshot = {
  clientId: string;
  generatedAt: string;
  lenses: Record<
    InsightLens,
    {
      label: string;
      findings: InsightFinding[];
    }
  >;
};
