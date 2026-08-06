import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatRole } from "@/app/libs/roles";
import { clientDisplayText } from "@/app/libs/clientIdentity";
import { sevenDayHistoryStart } from "@/app/libs/documentationDay";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  const authorProviderId = searchParams.get("authorProviderId") ?? session.providerId;
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const sevenDaysAgo = sevenDayHistoryStart();

  const client = await db.client.findFirst({
    where: {
      id: clientId,
      providerClients: {
        some: {
          providerId: session.providerId,
        },
      },
    },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entries = await db.entry.findMany({
    where: {
      clientId,
      providerId: authorProviderId,
      date: {
        gte: sevenDaysAgo,
      },
      OR: [
        {
          visibility: "Shared",
        },
        {
          providerId: session.providerId,
        },
      ],
      AND: [
        {
          OR: [
            {
              note: {
                not: null,
              },
            },
            {
              items: {
                some: {},
              },
            },
            {
              abcObservations: {
                some: {},
              },
            },
          ],
        },
      ],
    },
    orderBy: {
      date: "desc",
    },
    select: {
      id: true,
      providerId: true,
      kind: true,
      visibility: true,
      status: true,
      note: true,
      clinicalReflection: true,
      contextData: true,
      date: true,
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      finalScore: true,
      items: {
        orderBy: {
          createdAt: "asc",
        },
        select: {
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
              targetValue: true,
              comparison: true,
              measurementProfile: true,
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
      revisions: {
        orderBy: {
          revisionNumber: "asc",
        },
        select: {
          id: true,
          revisionNumber: true,
          changes: true,
          createdAt: true,
          createdBy: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      },
      provider: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  if (entries.length > 0) {
    const readAt = new Date();
    await Promise.all([
      db.entryRead.createMany({
        data: entries.map((entry) => ({
          entryId: entry.id,
          providerId: session.providerId,
          readAt,
        })),
        skipDuplicates: true,
      }),
      db.entryRead.updateMany({
        where: {
          providerId: session.providerId,
          entryId: {
            in: entries.map((entry) => entry.id),
          },
          readAt: null,
        },
        data: {
          readAt,
        },
      }),
    ]);
  }

  return NextResponse.json({
    clientId,
    clientInitials: `${client.firstName.slice(0, 2)}${client.lastName.slice(0, 2)}`,
    backLabel: session.role === "Caregiver" ? "Back to Children" : "Back to Client",
    entries: consolidateEntries(entries, client),
  });
}

function consolidateEntries(entries: Array<{
  id: string;
  providerId: string;
  kind: string;
  visibility: string;
  status: string;
  note: string | null;
  clinicalReflection: string | null;
  contextData: unknown;
  date: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  finalScore: number | null;
  provider: {
    firstName: string;
    lastName: string;
    role: string;
  };
  items: Array<{
    target: string;
    goal: string;
    score: number | null;
    metricType: "Percentage" | "Frequency" | "Duration" | "Subjective";
    domain:
      | "Behavior"
      | "SkillAcquisition"
      | "Communication"
      | "Adaptive"
      | "Regulation"
      | "Other"
      | null;
    rawValue: number | null;
    supportLevel: number | null;
    observation: string | null;
    goalDefinition: {
      targetValue: number | null;
      comparison: "LessThan" | "GreaterThan" | "Equal" | null;
      measurementProfile: string | null;
    } | null;
  }>;
  abcObservations: Array<{
    id: string;
    antecedent: string;
    behavior: string;
    consequence: string;
  }>;
  revisions: Array<{
    id: string;
    revisionNumber: number;
    changes: unknown;
    createdAt: Date;
    createdBy: {
      firstName: string;
      lastName: string;
      role: string;
    };
  }>;
}>, client: { firstName: string; lastName: string }) {
  const formatted = entries.map((entry) => {
    const providerName = `${entry.provider.firstName} ${entry.provider.lastName}`;
    const safeText = (value: string) =>
      clientDisplayText(value, client.firstName, client.lastName);

    return {
      id: entry.id,
      kind: entry.kind,
      status: entry.status,
      note: safeText(entry.note ?? ""),
      clinicalReflection: entry.clinicalReflection
        ? safeText(entry.clinicalReflection)
        : null,
      contextData: entry.contextData,
      date: entry.date.toISOString(),
      completedAt: (entry.completedAt ?? entry.updatedAt).toISOString(),
      finalScore: entry.finalScore,
      providerName,
      providerRole: formatRole(entry.provider.role),
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
      revisions: entry.revisions.map((revision) => ({
        id: revision.id,
        revisionNumber: revision.revisionNumber,
        createdAt: revision.createdAt.toISOString(),
        createdByName: `${revision.createdBy.firstName} ${revision.createdBy.lastName}`,
        createdByRole: formatRole(revision.createdBy.role),
        changes: sanitizeRevisionChanges(revision.changes, safeText),
      })),
      sensoryObservations: extractSensoryObservations(
        entry.contextData,
        entry.createdAt,
        providerName
      ),
      communicationObservations: extractCommunicationObservations(
        entry.contextData,
        entry.createdAt,
        providerName
      ),
    };
  });

  const sensoryByDay = new Map<string, (typeof formatted)[number]["sensoryObservations"]>();
  const communicationByDay = new Map<
    string,
    (typeof formatted)[number]["communicationObservations"]
  >();
  const inProgressSensoryDays = new Set<string>();
  const inProgressCommunicationDays = new Set<string>();
  for (const entry of formatted) {
    const key = entryDayKey(entry);
    if (entry.kind === "SensoryObservation") {
      const existing = sensoryByDay.get(key) ?? [];
      sensoryByDay.set(key, [...existing, ...entry.sensoryObservations]);
      if (entry.status !== "COMPLETED") {
        inProgressSensoryDays.add(key);
      }
    }
    if (entry.kind === "CommunicationObservation") {
      const existing = communicationByDay.get(key) ?? [];
      communicationByDay.set(key, [...existing, ...entry.communicationObservations]);
      if (entry.status !== "COMPLETED") {
        inProgressCommunicationDays.add(key);
      }
    }
  }

  const daysWithTherapyProgress = new Set(
    formatted
      .filter(
        (entry) =>
          entry.kind === "SessionNote" &&
          entry.providerRole === "Occupational Therapist"
      )
      .map(entryDayKey)
  );
  const daysWithSpeechProgress = new Set(
    formatted
      .filter(
        (entry) =>
          entry.kind === "SpeechProgress" &&
          entry.providerRole === "Speech Pathologist"
      )
      .map(entryDayKey)
  );

  return formatted
    .filter((entry) => {
      if (entry.kind === "SensoryObservation") {
        return !daysWithTherapyProgress.has(entryDayKey(entry));
      }
      if (entry.kind === "CommunicationObservation") {
        return !daysWithSpeechProgress.has(entryDayKey(entry));
      }
      return true;
    })
    .map((entry) => {
      if (
        entry.kind !== "SessionNote" ||
        entry.providerRole !== "Occupational Therapist"
      ) {
        return entry;
      }

      return {
        ...entry,
        status: inProgressSensoryDays.has(entryDayKey(entry))
          ? "IN_PROGRESS"
          : entry.status,
        sensoryObservations: sensoryByDay.get(entryDayKey(entry)) ?? [],
      };
    })
    .map((entry) => {
      if (
        entry.kind !== "SpeechProgress" ||
        entry.providerRole !== "Speech Pathologist"
      ) {
        return entry;
      }

      return {
        ...entry,
        status: inProgressCommunicationDays.has(entryDayKey(entry))
          ? "IN_PROGRESS"
          : entry.status,
        communicationObservations: communicationByDay.get(entryDayKey(entry)) ?? [],
      };
    });
}

function sanitizeRevisionChanges(
  value: unknown,
  safeText: (value: string) => string
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (change): change is {
        path: string;
        label: string;
        before: unknown;
        after: unknown;
      } =>
        Boolean(change) &&
        typeof change === "object" &&
        typeof change.path === "string" &&
        typeof change.label === "string"
    )
    .map((change) => ({
      ...change,
      before: sanitizeRevisionValue(change.before, safeText),
      after: sanitizeRevisionValue(change.after, safeText),
    }));
}

function sanitizeRevisionValue(
  value: unknown,
  safeText: (value: string) => string
): unknown {
  if (typeof value === "string") {
    return safeText(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeRevisionValue(item, safeText));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        sanitizeRevisionValue(child, safeText),
      ])
    );
  }
  return value;
}

function entryDayKey(entry: { date: string }) {
  return entry.date.slice(0, 10);
}

function extractSensoryObservations(
  value: unknown,
  createdAt: Date,
  author: string
) {
  if (!value || typeof value !== "object" || !("observations" in value)) {
    return [];
  }

  const observations = (value as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations
    .map((item) => ({
      category:
        typeof item === "object" &&
        item !== null &&
        "category" in item &&
        typeof item.category === "string"
          ? item.category
          : "",
      observation:
        typeof item === "object" &&
        item !== null &&
        "observation" in item &&
        typeof item.observation === "string"
          ? item.observation
          : "",
      recommendation:
        typeof item === "object" &&
        item !== null &&
        "recommendation" in item &&
        typeof item.recommendation === "string"
          ? item.recommendation
          : "",
      timestamp: createdAt.toISOString(),
      author,
    }))
    .filter((item) => item.category && item.observation);
}

function extractCommunicationObservations(
  value: unknown,
  createdAt: Date,
  author: string
) {
  return extractObservationItems(value, createdAt, author);
}

function extractObservationItems(
  value: unknown,
  createdAt: Date,
  author: string
) {
  if (!value || typeof value !== "object" || !("observations" in value)) {
    return [];
  }

  const observations = (value as { observations?: unknown }).observations;
  if (!Array.isArray(observations)) {
    return [];
  }

  return observations
    .map((item) => ({
      category:
        typeof item === "object" &&
        item !== null &&
        "category" in item &&
        typeof item.category === "string"
          ? item.category
          : "",
      observation:
        typeof item === "object" &&
        item !== null &&
        "observation" in item &&
        typeof item.observation === "string"
          ? item.observation
          : "",
      recommendation:
        typeof item === "object" &&
        item !== null &&
        "recommendation" in item &&
        typeof item.recommendation === "string"
          ? item.recommendation
          : "",
      timestamp: createdAt.toISOString(),
      author,
    }))
    .filter((item) => item.category && item.observation);
}
