/**
 * Server-side boundary for one client's interdisciplinary day.
 * It loads completed notes, runs existing normalization and attention rules, and
 * returns ClientDayContext for the central handoff without generating UI prose.
 */
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
  type NormalizableEntry,
  type NormalizableTeamFocus,
} from "@/app/libs/clinicalNormalization";
import { createClientDayContext } from "./clientDayContext";
import type {
  ClientDayContext,
  ClientDayContextBuildOptions,
  ClientDayEntryRef,
  ClientDayStatus,
} from "./types";
import type { Prisma } from "@prisma/client";
import { isTeamFocusVisible } from "@/app/libs/teamFocusLifecycle";

const DEFAULT_HISTORY_DAYS = 14;

export async function buildClientDayContext(input: {
  clientId: string;
  date: Date | string;
  viewerProviderId?: string;
  viewerRole?: string;
  currentDate?: Date | string;
}): Promise<ClientDayContext | null> {
  const options: ClientDayContextBuildOptions = {
    viewerProviderId: input.viewerProviderId,
    viewerRole: input.viewerRole,
    currentDate: input.currentDate,
  };
  const clinicalDate = clinicalDateString(input.date);
  const { start, end } = clinicalDateRange(clinicalDate);
  const currentClinicalDate = clinicalDateString(options.currentDate ?? new Date());
  const status: ClientDayStatus =
    clinicalDate < currentClinicalDate ? "FINALIZED" : "LIVE";

  const clientWhere =
    options.viewerProviderId && options.viewerRole !== "Supervisor"
      ? {
          id: input.clientId,
          providerClients: {
            some: {
              providerId: options.viewerProviderId,
            },
          },
        }
      : { id: input.clientId };

  const client = await db.client.findFirst({
    where: clientWhere,
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!client) {
    return null;
  }

  const historyStart = new Date(start);
  historyStart.setDate(historyStart.getDate() - DEFAULT_HISTORY_DAYS);

  const [entries, historicalEntries, activeTeamFocus, providerAssignments] = await Promise.all([
    db.entry.findMany({
      where: {
        clientId: input.clientId,
        date: {
          gte: start,
          lt: end,
        },
        status:
          status === "LIVE"
            ? { in: ["IN_PROGRESS", "COMPLETED"] }
            : "COMPLETED",
        ...visibleEntryWhere(options.viewerProviderId),
      },
      orderBy: [{ date: "asc" }, { completedAt: "asc" }, { updatedAt: "asc" }, { id: "asc" }],
      select: clientDayEntrySelect,
    }),
    db.entry.findMany({
      where: {
        clientId: input.clientId,
        date: {
          gte: historyStart,
          lt: start,
        },
        status: "COMPLETED",
        ...visibleEntryWhere(options.viewerProviderId),
      },
      orderBy: [{ date: "desc" }, { completedAt: "desc" }, { updatedAt: "desc" }],
      select: clientDayEntrySelect,
    }),
    db.teamFocus.findFirst({
      where: {
        clientId: input.clientId,
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
      where: { clientId: input.clientId },
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
  const completedEntries = entries
    .filter((entry) => entry.status === "COMPLETED")
    .map((entry) => toClientDayEntryRef(entry, clinicalDate, client));
  const inProgressEntries = entries
    .filter((entry) => entry.status === "IN_PROGRESS")
    .map((entry) => toClientDayEntryRef(entry, clinicalDate, client));
  const currentEvents = normalizeClinicalEvents({
    entries: entries.map((entry) => toNormalizableEntry(entry, client)),
  });
  const historicalEvents = normalizeClinicalEvents({
    entries: historicalEntries.map((entry) =>
      toNormalizableEntry(entry, client)
    ),
  });
  const teamFocusEvents =
    activeTeamFocus &&
    isTeamFocusVisible(activeTeamFocus.displayStartedAt) &&
    new Date(activeTeamFocus.updatedAt) < end
      ? normalizeClinicalEvents({
          teamFocusItems: [
            toNormalizableTeamFocus(activeTeamFocus, client),
          ],
        })
      : [];
  const attentionResult = generateAttention({
    currentEvents: [...currentEvents, ...teamFocusEvents],
    historicalEvents,
    providerAssignments: assignments,
  });

  return createClientDayContext({
    client: {
      id: client.id,
      name: clientDisplayCode(client.firstName, client.lastName),
    },
    date: clinicalDate,
    status,
    completedEntries,
    inProgressEntries,
    clinicalEvents: [...currentEvents, ...teamFocusEvents],
    attentionEvents: attentionResult.attentionEvents,
    supervisorDirectives: attentionResult.supervisorDirectives,
  });
}

const clientDayEntrySelect = {
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
  completedAt: true,
  revisions: {
    orderBy: {
      revisionNumber: "desc",
    },
    take: 1,
    select: {
      revisionNumber: true,
      changes: true,
      createdAt: true,
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

type ClientDayEntryRecord = Prisma.EntryGetPayload<{ select: typeof clientDayEntrySelect }>;

function visibleEntryWhere(viewerProviderId?: string) {
  if (!viewerProviderId) {
    return {
      visibility: "Shared" as const,
    };
  }

  return {
    OR: [{ visibility: "Shared" as const }, { providerId: viewerProviderId }],
  };
}

function toClientDayEntryRef(
  entry: ClientDayEntryRecord,
  clinicalDate: string,
  client: { firstName: string; lastName: string }
): ClientDayEntryRef {
  const completedAt = entry.completedAt ?? entry.updatedAt;
  const latestRevision = entry.revisions[0];

  return {
    entryId: entry.id,
    clientId: entry.clientId,
    providerId: entry.providerId,
    providerName: providerName(entry.provider),
    providerRole: entry.provider.role,
    kind: entry.kind,
    status: entry.status,
    visibility: entry.visibility,
    sessionObservation: entry.note
      ? clientDisplayText(entry.note, client.firstName, client.lastName)
      : entry.note,
    clinicalDate,
    occurredAt: entry.date.toISOString(),
    completedAt: completedAt.toISOString(),
    revisionNumber: latestRevision?.revisionNumber,
    revisedAt:
      latestRevision && latestRevision.revisionNumber > 1
        ? latestRevision.createdAt.toISOString()
        : undefined,
    revisionChangeLabels:
      latestRevision && latestRevision.revisionNumber > 1
        ? revisionChangeLabels(latestRevision.changes)
        : undefined,
  };
}

function toNormalizableEntry(
  entry: ClientDayEntryRecord,
  client: { firstName: string; lastName: string }
): NormalizableEntry {
  const safeText = (value: string) =>
    clientDisplayText(value, client.firstName, client.lastName);

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

function providerName(provider: { firstName: string; lastName: string }) {
  return `${provider.firstName} ${provider.lastName}`.trim();
}

function revisionChangeLabels(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((change) => {
      if (
        !change ||
        typeof change !== "object" ||
        Array.isArray(change) ||
        typeof change.label !== "string"
      ) {
        return null;
      }
      return change.label;
    })
    .filter((label): label is string => Boolean(label));
}

function clinicalDateString(value: Date | string) {
  if (value instanceof Date) {
    return localDateParts(value);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return localDateParts(new Date(value));
}

function clinicalDateRange(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 1);
  return { start, end };
}

function localDateParts(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}
