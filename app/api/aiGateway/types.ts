import type {
  AttentionEvent,
  AttentionLevel,
  SupervisorDirective,
} from "@/app/libs/clinicalAttention";
import type { ClinicalEvent } from "@/app/libs/clinicalNormalization";

export type GatewayClient = {
  id: string;
  name: string;
};

export type GatewaySession = {
  entryId: string;
  date: string;
  kind: string;
};

export type GatewayProvider = {
  id: string;
  name: string;
  role: string;
};

export type GatewayHistoricalPattern = {
  value: string;
  count: number;
  clinicalEventIds: string[];
  lastObservedAt: string;
  sourceProviderRoles: string[];
};

export type GatewayAttentionPattern = {
  attentionType: AttentionEvent["attentionType"];
  count: number;
  attentionEventIds: string[];
  lastObservedAt: string;
  levels: AttentionEvent["level"][];
};

export type GatewayPreviousSession = {
  entryId: string;
  date: string;
  kind: string;
  provider: GatewayProvider;
  clinicalEvents: ClinicalEvent[];
};

export type GatewayHistoricalPatterns = {
  recurringAntecedents: GatewayHistoricalPattern[];
  recurringTargets: GatewayHistoricalPattern[];
  repeatedAttentionEvents: GatewayAttentionPattern[];
  recentProviderObservations: GatewayHistoricalPattern[];
};

export type GatewayContext = {
  client: GatewayClient;
  session: GatewaySession;
  provider: GatewayProvider;
  clinicalEvents: ClinicalEvent[];
  attentionEvents: AttentionEvent[];
  supervisorDirectives: SupervisorDirective[];
  activeTeamFocus: SupervisorDirective | null;
  sessionObservation: string | null;
  previousSessions: GatewayPreviousSession[];
  providerHistory: ClinicalEvent[];
  historicalPatterns: GatewayHistoricalPatterns;
};

export type GatewayContextBuildOptions = {
  historyDays?: number;
  historyEntryLimit?: number;
  previousSessionLimit?: number;
  providerHistoryLimit?: number;
  patternLimit?: number;
};

export type ClientDayStatus = "LIVE" | "FINALIZED";

export type ClientDayEntryRef = {
  entryId: string;
  clientId: string;
  providerId: string;
  providerName: string;
  providerRole: string;
  kind: string;
  status?: string;
  visibility: string;
  sessionObservation?: string | null;
  clinicalDate: string;
  occurredAt: string;
  completedAt: string;
  revisionNumber?: number;
  revisedAt?: string;
  revisionChangeLabels?: string[];
};

export type ClientDaySourceCategory =
  | "target_progress"
  | "caregiver_context"
  | "reinforcer"
  | "team_focus"
  | "supervisor_directive"
  | "session_observation"
  | "clinical_reflection"
  | "communication_observation"
  | "sensory_observation"
  | "abc_observation"
  | "provider_observation"
  | "attention_event";

export type ClientDaySourceItem = {
  id: string;
  clientId: string;
  entryId?: string;
  providerId: string;
  providerName: string;
  providerRole: string;
  clinicalDate: string;
  occurredAt: string;
  completedAt?: string;
  sourceCategory: ClientDaySourceCategory;
  sourceItemId?: string;
  sectionKey?: string;
  label: string;
  snippet: string;
  clinicalEventIds: string[];
  attentionEventIds?: string[];
  directiveIds?: string[];
  revisionNumber?: number;
  revisedAt?: string;
  revisionChangeLabels?: string[];
};

export type ClientDaySourceReference = {
  id: string;
  clientId: string;
  entryId?: string;
  providerId: string;
  providerName: string;
  providerRole: string;
  clinicalDate: string;
  completedAt?: string;
  sourceCategory: ClientDaySourceCategory;
  sourceItemId?: string;
  sectionKey?: string;
  label: string;
  snippet: string;
  clinicalEventIds: string[];
  attentionEventIds?: string[];
  directiveIds?: string[];
  revisionNumber?: number;
  revisedAt?: string;
  revisionChangeLabels?: string[];
};

export type ClientDayContext = {
  client: GatewayClient;
  date: string;
  status: ClientDayStatus;
  completedEntries: ClientDayEntryRef[];
  inProgressEntries?: ClientDayEntryRef[];
  clinicalEvents: ClinicalEvent[];
  attentionEvents: AttentionEvent[];
  caregiverContext: ClientDaySourceItem[];
  reinforcerObservations: ClientDaySourceItem[];
  teamFocus: ClientDaySourceItem | null;
  supervisorDirectives: ClientDaySourceItem[];
  sessionObservations: ClientDaySourceItem[];
  sourceReferences: ClientDaySourceReference[];
  highestAttentionLevel: AttentionLevel | null;
  meaningfulEventCount: number;
  routineEventCount: number;
  completedEntryCount: number;
  inProgressEntryCount?: number;
  contributingProviderRoles: string[];
  generatedAt: string;
  lastUpdatedAt: string;
};

export type ClientDayContextInput = {
  client: GatewayClient;
  date: string;
  status: ClientDayStatus;
  completedEntries: ClientDayEntryRef[];
  inProgressEntries?: ClientDayEntryRef[];
  clinicalEvents: ClinicalEvent[];
  attentionEvents: AttentionEvent[];
  supervisorDirectives: SupervisorDirective[];
  generatedAt?: string;
};

export type ClientDayContextBuildOptions = {
  viewerProviderId?: string;
  viewerRole?: string;
  currentDate?: Date | string;
};

export type ClientDailyHandoffItem = {
  id: string;
  title: string;
  summary: string;
  providerRoles: string[];
  sourceReferenceIds: string[];
  clinicalEventIds: string[];
  attentionEventIds?: string[];
  directiveIds?: string[];
  level?: AttentionLevel | "routine" | "important" | "critical";
};

export type ClientDailyHandoffSection = {
  key:
    | "home-context"
    | "session-context"
    | "provider-observations"
    | "emerging-priorities";
  title: string;
  summary: string;
  sourceReferenceIds: string[];
};

export type ClientDailyHandoff = {
  client: GatewayClient;
  date: string;
  status: ClientDayStatus;
  overview: string;
  sections: ClientDailyHandoffSection[];
  keyEvents: ClientDailyHandoffItem[];
  currentConsiderations: ClientDailyHandoffItem[];
  positiveDevelopments: ClientDailyHandoffItem[];
  supportingReferences: ClientDaySourceReference[];
  highestAttentionLevel: AttentionLevel | null;
  hasMeaningfulEvents: boolean;
  completedEntryCount: number;
  inProgressEntryCount?: number;
  contributingProviderRoles: string[];
  generatedAt: string;
  lastUpdatedAt: string;
};
