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
      ],
    },
    orderBy: {
      date: "desc",
    },
    take: 7,
    select: {
      id: true,
      providerId: true,
      note: true,
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

  await db.entryRead.createMany({
    data: entries.map((entry) => ({
      entryId: entry.id,
      providerId: session.providerId,
      readAt: new Date(),
    })),
    skipDuplicates: true,
  });

  await db.entryRead.updateMany({
    where: {
      providerId: session.providerId,
      entryId: {
        in: entries.map((entry) => entry.id),
      },
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  return (
    <NoteHistoryViewer
      clientId={clientId}
      clientInitials={`${client.firstName.slice(0, 2)}${client.lastName.slice(0, 2)}`}
      entries={entries.map((entry) => ({
        id: entry.id,
        note: entry.note ?? "",
        date: entry.date.toISOString(),
        finalScore: entry.finalScore,
        providerName: `${entry.provider.firstName} ${entry.provider.lastName}`,
        providerRole: formatRole(entry.provider.role),
        items: entry.items,
      }))}
      backLabel={session.role === "Caregiver" ? "Back to Children" : "Back to Client"}
    />
  );
}
