import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatRole } from "@/app/libs/roles";

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

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

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
    entries: entries.map((entry) => ({
      id: entry.id,
      note: entry.note ?? "",
      date: entry.date.toISOString(),
      finalScore: entry.finalScore,
      providerName: `${entry.provider.firstName} ${entry.provider.lastName}`,
      providerRole: formatRole(entry.provider.role),
      items: entry.items,
    })),
  });
}
