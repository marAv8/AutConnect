import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import NoteHistoryViewer from "./NoteHistoryViewer";
import { formatRole } from "@/app/libs/roles";

export default async function ViewNotePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string; authorProviderId?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { clientId, authorProviderId } = await searchParams;
  if (!clientId) {
    redirect("/dashboard");
  }
  const noteAuthorProviderId = authorProviderId ?? session.providerId;
  const sevenDaysAgo = sevenDayWindowStart();

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true },
  });
  if (!client) {
    redirect("/dashboard");
  }

  const entries = await db.entry.findMany({
    where: {
      clientId,
      providerId: noteAuthorProviderId,
      date: {
        gte: sevenDaysAgo,
      },
      AND: [
        {
          OR: [
            {
              kind: {
                notIn: ["SupervisorObservation", "ClinicalNote"],
              },
            },
            {
              visibility: "Shared",
            },
            {
              providerId: session.providerId,
            },
          ],
        },
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
      createdAt: true,
      updatedAt: true,
      completedAt: true,
      date: true,
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
      provider: {
        select: {
          firstName: true,
          lastName: true,
          role: true,
        },
      },
    },
  });

  if (entries.length === 0) {
    redirect(`/dashboard?clientId=${clientId}`);
  }

  const readAt = new Date();
  const sharedEntries = entries.filter((entry) => entry.visibility === "Shared");

  if (sharedEntries.length > 0) {
    await Promise.all([
      db.entryRead.createMany({
        data: sharedEntries.map((entry) => ({
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
            in: sharedEntries.map((entry) => entry.id),
          },
          readAt: null,
        },
        data: {
          readAt,
        },
      }),
    ]);
  }
  return (
    <NoteHistoryViewer
      clientId={clientId}
      clientInitials={`${client.firstName.slice(0, 2)}${client.lastName.slice(0, 2)}`}
      entries={entries.map((entry) => ({
        id: entry.id,
        kind: entry.kind,
        status: entry.status,
        note: entry.note ?? "",
        clinicalReflection: entry.clinicalReflection,
        contextData: entry.contextData,
        date: entry.date.toISOString(),
        completedAt: (entry.completedAt ?? entry.updatedAt).toISOString(),
        finalScore: entry.finalScore,
        providerName: `${entry.provider.firstName} ${entry.provider.lastName}`,
        providerRole: formatRole(entry.provider.role),
        items: entry.items,
        abcObservations: entry.abcObservations,
        sensoryObservations: extractObservations(
          entry.kind === "SensoryObservation" ? entry.contextData : null,
          entry.createdAt,
          `${entry.provider.firstName} ${entry.provider.lastName}`
        ),
        communicationObservations: extractObservations(
          entry.kind === "CommunicationObservation" ? entry.contextData : null,
          entry.createdAt,
          `${entry.provider.firstName} ${entry.provider.lastName}`
        ),
      }))}
      variant="overlay"
      backLabel={session.role === "Caregiver" ? "Back to Children" : "Back to Client"}
    />
  );
}

function sevenDayWindowStart() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  return start;
}

function extractObservations(value: unknown, createdAt: Date, author: string) {
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
