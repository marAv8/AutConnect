import { db } from "@/lib/db";
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
        status: "COMPLETED",
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
  const completedEntries = entries.map((entry) => toClientDayEntryRef(entry, clinicalDate));
  const currentEvents = normalizeClinicalEvents({
    entries: entries.map(toNormalizableEntry),
  });
  const historicalEvents = normalizeClinicalEvents({
    entries: historicalEntries.map(toNormalizableEntry),
  });
  const teamFocusEvents =
    activeTeamFocus && new Date(activeTeamFocus.updatedAt) < end
      ? normalizeClinicalEvents({
          teamFocusItems: [toNormalizableTeamFocus(activeTeamFocus)],
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
      name: `${client.firstName} ${client.lastName}`.trim(),
    },
    date: clinicalDate,
    status,
    completedEntries,
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
  clinicalDate: string
): ClientDayEntryRef {
  const completedAt = entry.completedAt ?? entry.updatedAt;

  return {
    entryId: entry.id,
    clientId: entry.clientId,
    providerId: entry.providerId,
    providerName: providerName(entry.provider),
    providerRole: entry.provider.role,
    kind: entry.kind,
    visibility: entry.visibility,
    sessionObservation: entry.note,
    clinicalDate,
    occurredAt: entry.date.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}

function toNormalizableEntry(entry: ClientDayEntryRecord): NormalizableEntry {
  return {
    id: entry.id,
    clientId: entry.clientId,
    date: entry.date,
    kind: entry.kind,
    note: entry.note,
    contextData: entry.contextData,
    providerId: entry.providerId,
    provider: entry.provider,
    items: entry.items,
    abcObservations: entry.abcObservations,
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
}): NormalizableTeamFocus {
  return {
    id: teamFocus.id,
    clientId: teamFocus.clientId,
    title: teamFocus.title,
    content: teamFocus.content,
    updatedAt: teamFocus.updatedAt,
    authorId: teamFocus.authorId,
    author: teamFocus.author,
  };
}

function providerName(provider: { firstName: string; lastName: string }) {
  return `${provider.firstName} ${provider.lastName}`.trim();
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
