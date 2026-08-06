export type ClientSignalColor = "neutral" | "blue" | "amber" | "red";

export type ClientSignalEvidence = {
  entryId?: string;
  providerId?: string;
  providerRole?: string;
  observedAt: string;
  label: string;
};

export type ClientSignalSnapshot = {
  sessionDate: string | null;
  color: ClientSignalColor;
  reason: string;
  explanation: string;
  confidence: "low" | "moderate" | "high";
  observedAt: string | null;
  expiresAt: string | null;
  status: "proposed";
  requiresSupervisorReview: boolean;
  isUnread: boolean;
  evidence: ClientSignalEvidence[];
};

export type SignalEntry = {
  id: string;
  providerId: string;
  providerRole: string;
  date: Date | string;
  note?: string | null;
  items: Array<{
    goalId?: string | null;
    target: string;
    goal: string;
    score?: number | null;
    rawValue?: number | null;
    metricType?: string | null;
    measurementProfile?: string | null;
    targetValue?: number | null;
    comparison?: string | null;
    observation?: string | null;
  }>;
  abcObservations: Array<{
    antecedent: string;
    behavior: string;
    consequence: string;
  }>;
};

export type SignalTeamFocus = {
  id: string;
  title?: string | null;
  content: string;
  updatedAt: Date | string;
};

export type SignalSemanticEvidence = {
  entryId: string;
  positiveChange: "none" | "possible" | "clear";
  supportConcern: "none" | "possible" | "clear";
  seriousBehavior: "none" | "possible" | "clear";
  interventionContext?: string | null;
  rationale?: string | null;
};

export type SignalCaseRequest = {
  id: string;
  status: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  concern: string;
  requestedSupport: string;
  linkedCaseStatus?: string | null;
};
