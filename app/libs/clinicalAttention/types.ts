import type { ClinicalEvent } from "@/app/libs/clinicalNormalization";

export type AttentionLevel = "none" | "low" | "medium" | "high" | "critical";

export type AttentionType =
  | "new_behavior"
  | "regression"
  | "improvement"
  | "mastery"
  | "increased_support"
  | "reduced_independence"
  | "new_intervention"
  | "new_reinforcer"
  | "abc_pattern"
  | "environmental_trigger"
  | "caregiver_context"
  | "sensory_concern"
  | "communication_update"
  | "supervisor_observation"
  | "safety_concern";

export type AttentionAudience = {
  providerIds?: string[];
  roles?: string[];
  includeAuthor: boolean;
  scope: "entire_team" | "role_based" | "assigned_today" | "author_only";
};

export type AttentionEvent = {
  id: string;
  clientId: string;
  createdAt: string;
  clinicalEventIds: string[];
  source: {
    providerId: string;
    providerName: string;
    providerRole: string;
  };
  attentionType: AttentionType;
  level: Exclude<AttentionLevel, "none">;
  title: string;
  summary: string;
  rationale: string;
  audience: AttentionAudience;
  metadata?: Record<string, unknown>;
};

export type SupervisorDirective = {
  id: string;
  clientId: string;
  createdAt: string;
  clinicalEventIds: string[];
  source: {
    providerId: string;
    providerName: string;
    providerRole: string;
  };
  directiveType: "team_focus";
  level: "routine" | "important" | "critical";
  title: string;
  summary: string;
  rationale: string;
  audience: AttentionAudience;
  status: {
    lifecycle: "active_until_replaced";
  };
  metadata?: Record<string, unknown>;
};

export type ProviderAssignment = {
  providerId: string;
  providerRole: string;
  assignedToday?: boolean;
};

export type AttentionGenerationInput = {
  currentEvents: ClinicalEvent[];
  historicalEvents?: ClinicalEvent[];
  providerAssignments?: ProviderAssignment[];
};

export type AttentionGenerationResult = {
  attentionEvents: AttentionEvent[];
  supervisorDirectives: SupervisorDirective[];
  summary: AttentionSummary;
};

export type AttentionSummary = {
  clientId: string | null;
  highestLevel: AttentionLevel;
  activeCount: number;
  directiveCount: number;
  attentionEventIds: string[];
  supervisorDirectiveIds: string[];
  topEvents: AttentionEvent[];
};
