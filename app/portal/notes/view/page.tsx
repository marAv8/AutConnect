import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import NoteHistoryViewer from "./NoteHistoryViewer";
import { formatRole } from "@/app/libs/roles";
import { clientDisplayText } from "@/app/libs/clientIdentity";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";
import {
  redactMedicationContextData,
  redactMedicationNote,
  redactMedicationRevisionValue,
  shouldRedactCaregiverMedication,
} from "@/app/libs/caregiverMedicationPrivacy";

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

  const [client, authenticatedProvider] = await Promise.all([
    db.client.findFirst({
      where: {
        id: clientId,
        providerClients: {
          some: { providerId: session.providerId, revokedAt: null },
        },
      },
      select: { firstName: true, lastName: true },
    }),
    db.provider.findUnique({
      where: { id: session.providerId },
      select: { firstName: true, lastName: true, role: true },
    }),
  ]);
  if (!client || !authenticatedProvider) {
    redirect("/dashboard");
  }
  const authenticatedDisplayName = formatProviderDisplayName(
    authenticatedProvider.firstName,
    authenticatedProvider.lastName
  );

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
      entries={entries.map((entry) => {
        const redactMedication = shouldRedactCaregiverMedication({
          kind: entry.kind,
          viewerProviderId: session.providerId,
          viewerRole: authenticatedProvider.role,
          authorProviderId: entry.providerId,
        });
        const contextData = redactMedication
          ? redactMedicationContextData(entry.contextData)
          : entry.contextData;
        const note = redactMedication
          ? redactMedicationNote(entry.note)
          : entry.note;
        return {
          id: entry.id,
          kind: entry.kind,
          status: entry.status,
          note: note ?? "",
          clinicalReflection: entry.clinicalReflection,
          contextData,
          date: entry.date.toISOString(),
          completedAt: (entry.completedAt ?? entry.updatedAt).toISOString(),
          finalScore: entry.finalScore,
          providerName: formatProviderDisplayName(
            entry.provider.firstName,
            entry.provider.lastName
          ),
          providerRole: formatRole(entry.provider.role),
          items: entry.items,
          abcObservations: entry.abcObservations,
          revisions: entry.revisions.map((revision) => ({
            id: revision.id,
            revisionNumber: revision.revisionNumber,
            createdAt: revision.createdAt.toISOString(),
            createdByName: formatProviderDisplayName(
              revision.createdBy.firstName,
              revision.createdBy.lastName
            ),
            createdByRole: formatRole(revision.createdBy.role),
            changes: redactMedication
              ? redactMedicationRevisionValue(
                  sanitizeRevisionChanges(
                    revision.changes,
                    client.firstName,
                    client.lastName
                  )
                )
              : sanitizeRevisionChanges(
                  revision.changes,
                  client.firstName,
                  client.lastName
                ),
          })),
          sensoryObservations: extractObservations(
            entry.kind === "SensoryObservation" ? contextData : null,
            entry.createdAt,
            formatProviderDisplayName(
              entry.provider.firstName,
              entry.provider.lastName
            )
          ),
          communicationObservations: extractObservations(
            entry.kind === "CommunicationObservation" ? contextData : null,
            entry.createdAt,
            formatProviderDisplayName(
              entry.provider.firstName,
              entry.provider.lastName
            )
          ),
        };
      })}
      variant="overlay"
      authenticatedDisplayName={authenticatedDisplayName}
      authenticatedRole={authenticatedProvider.role}
    />
  );
}

function sanitizeRevisionChanges(
  value: unknown,
  clientFirstName: string,
  clientLastName: string
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
      before: sanitizeRevisionValue(
        change.before,
        clientFirstName,
        clientLastName
      ),
      after: sanitizeRevisionValue(
        change.after,
        clientFirstName,
        clientLastName
      ),
    }));
}

function sanitizeRevisionValue(
  value: unknown,
  clientFirstName: string,
  clientLastName: string
): unknown {
  if (typeof value === "string") {
    return clientDisplayText(value, clientFirstName, clientLastName);
  }
  if (Array.isArray(value)) {
    return value.map((item) =>
      sanitizeRevisionValue(item, clientFirstName, clientLastName)
    );
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        sanitizeRevisionValue(child, clientFirstName, clientLastName),
      ])
    );
  }
  return value;
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
