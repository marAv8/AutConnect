import { db } from "@/lib/db";
import {
  clientDisplayCode,
  clientDisplayText,
} from "@/app/libs/clientIdentity";
import {
  generateAttention,
  type ProviderAssignment,
} from "@/app/libs/clinicalAttention";
import {
  normalizeClinicalEvents,
  type ClinicalEvent,
  type NormalizableEntry,
  type NormalizableTeamFocus,
} from "@/app/libs/clinicalNormalization";
import { createGatewayContext } from "./gatewayContext";
import type {
  GatewayContext,
  GatewayContextBuildOptions,
  GatewayPreviousSession,
  GatewayProvider,
} from "./types";
import type { Prisma } from "@prisma/client";
import { isTeamFocusVisible } from "@/app/libs/teamFocusLifecycle";

const DEFAULT_HISTORY_DAYS = 14;
const DEFAULT_HISTORY_ENTRY_LIMIT = 12;
const DEFAULT_PREVIOUS_SESSION_LIMIT = 5;
const DEFAULT_PROVIDER_HISTORY_LIMIT = 20;
const DEFAULT_PATTERN_LIMIT = 5;

export async function buildGatewayContextForEntry(
  entryId: string,
  options: GatewayContextBuildOptions = {}
): Promise<GatewayContext | null> {
  const currentEntry = await db.entry.findUnique({
    where: { id: entryId },
    select: gatewayEntrySelect,
  });

  if (!currentEntry) {
    return null;
  }

  const historyStart = new Date(currentEntry.date);
  historyStart.setDate(historyStart.getDate() - (options.historyDays ?? DEFAULT_HISTORY_DAYS));

  const [recentEntries, activeTeamFocus, providerAssignments] = await Promise.all([
    db.entry.findMany({
      where: {
        clientId: currentEntry.clientId,
        id: { not: currentEntry.id },
        date: {
          gte: historyStart,
          lt: currentEntry.date,
        },
        status: "COMPLETED",
        OR: [{ visibility: "Shared" }, { providerId: currentEntry.providerId }],
      },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take: options.historyEntryLimit ?? DEFAULT_HISTORY_ENTRY_LIMIT,
      select: gatewayEntrySelect,
    }),
    db.teamFocus.findFirst({
      where: {
        clientId: currentEntry.clientId,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        clientId: true,
        title: true,
        content: true,
        displayStartedAt: true,
        updatedAt: true,
        authorId: true,
        author: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    }),
    db.providerClient.findMany({
      where: { clientId: currentEntry.clientId },
      select: {
        providerId: true,
        role: true,
      },
    }),
  ]);

  const assignments: ProviderAssignment[] = providerAssignments.map((assignment) => ({
    providerId: assignment.providerId,
    providerRole: assignment.role,
    assignedToday: true,
  }));
  const currentEvents = normalizeClinicalEvents({
    entries: [toNormalizableEntry(currentEntry)],
  });
  const historicalEvents = normalizeClinicalEvents({
    entries: recentEntries.map(toNormalizableEntry),
  });
  const teamFocusEvents =
    activeTeamFocus &&
    isTeamFocusVisible(activeTeamFocus.displayStartedAt)
    ? normalizeClinicalEvents({
        teamFocusItems: [
          toNormalizableTeamFocus(activeTeamFocus, currentEntry.client),
        ],
      })
    : [];
  const currentAttention = generateAttention({
    currentEvents: [...currentEvents, ...teamFocusEvents],
    historicalEvents,
    providerAssignments: assignments,
  });
  const historicalAttentionEvents = generateAttention({
    currentEvents: historicalEvents,
    historicalEvents: [],
    providerAssignments: assignments,
  }).attentionEvents;

  return createGatewayContext({
    client: {
      id: currentEntry.client.id,
      name: clientDisplayCode(
        currentEntry.client.firstName,
        currentEntry.client.lastName
      ),
    },
    session: {
      entryId: currentEntry.id,
      date: currentEntry.date.toISOString(),
      kind: currentEntry.kind,
    },
    provider: toGatewayProvider(currentEntry.providerId, currentEntry.provider),
    clinicalEvents: currentEvents,
    attentionEvents: currentAttention.attentionEvents,
    supervisorDirectives: currentAttention.supervisorDirectives,
    sessionObservation: stringOrNull(
      currentEntry.note
        ? clientDisplayText(
            currentEntry.note,
            currentEntry.client.firstName,
            currentEntry.client.lastName
          )
        : currentEntry.note
    ),
    previousSessions: previousSessionsFromEntries(
      recentEntries,
      historicalEvents,
      options.previousSessionLimit ?? DEFAULT_PREVIOUS_SESSION_LIMIT
    ),
    providerHistory: historicalEvents
      .filter((event) => event.source.providerId === currentEntry.providerId)
      .sort((first, second) => second.occurredAt.localeCompare(first.occurredAt))
      .slice(0, options.providerHistoryLimit ?? DEFAULT_PROVIDER_HISTORY_LIMIT),
    historicalAttentionEvents,
    patternLimit: options.patternLimit ?? DEFAULT_PATTERN_LIMIT,
  });
}

const gatewayEntrySelect = {
  id: true,
  providerId: true,
  clientId: true,
  date: true,
  kind: true,
  visibility: true,
  status: true,
  note: true,
  contextData: true,
  updatedAt: true,
  client: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
  provider: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  },
  items: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      goalId: true,
      target: true,
      goal: true,
      score: true,
      metricType: true,
      domain: true,
      rawValue: true,
      supportLevel: true,
      observation: true,
      goalDefinition: {
        select: {
          measurementProfile: true,
          targetValue: true,
          comparison: true,
        },
      },
    },
  },
  abcObservations: {
    orderBy: {
      createdAt: "asc",
    },
    select: {
      id: true,
      antecedent: true,
      behavior: true,
      consequence: true,
    },
  },
} as const;

type GatewayEntryRecord = Prisma.EntryGetPayload<{ select: typeof gatewayEntrySelect }>;

function toNormalizableEntry(entry: NonNullable<GatewayEntryRecord>): NormalizableEntry {
  const safeText = (value: string) =>
    clientDisplayText(
      value,
      entry.client.firstName,
      entry.client.lastName
    );

  return {
    id: entry.id,
    clientId: entry.clientId,
    date: entry.date,
    kind: entry.kind,
    note: entry.note ? safeText(entry.note) : entry.note,
    contextData: entry.contextData,
    providerId: entry.providerId,
    provider: entry.provider,
    items: entry.items.map((item) => ({
      ...item,
      target: safeText(item.target),
      goal: safeText(item.goal),
    })),
    abcObservations: entry.abcObservations.map((observation) => ({
      ...observation,
      antecedent: safeText(observation.antecedent),
      behavior: safeText(observation.behavior),
      consequence: safeText(observation.consequence),
    })),
  };
}

function toNormalizableTeamFocus(teamFocus: {
  id: string;
  clientId: string;
  title: string | null;
  content: string;
  updatedAt: Date;
  authorId: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  };
}, client: { firstName: string; lastName: string }): NormalizableTeamFocus {
  return {
    id: teamFocus.id,
    clientId: teamFocus.clientId,
    title: teamFocus.title
      ? clientDisplayText(
          teamFocus.title,
          client.firstName,
          client.lastName
        )
      : teamFocus.title,
    content: clientDisplayText(
      teamFocus.content,
      client.firstName,
      client.lastName
    ),
    updatedAt: teamFocus.updatedAt,
    authorId: teamFocus.authorId,
    author: teamFocus.author,
  };
}

function previousSessionsFromEntries(
  entries: Array<NonNullable<GatewayEntryRecord>>,
  historicalEvents: ClinicalEvent[],
  limit: number
): GatewayPreviousSession[] {
  const eventsByEntryId = new Map<string, ClinicalEvent[]>();

  for (const event of historicalEvents) {
    const sourceEntryId = event.source.entryId;
    if (!sourceEntryId) continue;

    eventsByEntryId.set(sourceEntryId, [...(eventsByEntryId.get(sourceEntryId) ?? []), event]);
  }

  return entries
    .map((entry) => ({
      entryId: entry.id,
      date: entry.date.toISOString(),
      kind: entry.kind,
      provider: toGatewayProvider(entry.providerId, entry.provider),
      clinicalEvents: eventsByEntryId.get(entry.id) ?? [],
    }))
    .filter((session) => session.clinicalEvents.length > 0)
    .slice(0, limit);
}

function toGatewayProvider(
  providerId: string,
  provider: {
    firstName: string;
    lastName: string;
    role: string;
  }
): GatewayProvider {
  return {
    id: providerId,
    name: `${provider.firstName} ${provider.lastName}`.trim(),
    role: provider.role,
  };
}

function stringOrNull(value: string | null) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length > 0 ? trimmed : null;
}
