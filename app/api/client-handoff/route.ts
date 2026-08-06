import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { buildClientDailyHandoff } from "@/app/api/aiGateway";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId");
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }

  const today = startOfLocalDay(new Date());
  const previousSessionEntry = await db.entry.findFirst({
    where: {
      clientId,
      date: { lt: today },
      status: "COMPLETED",
      visibility: "Shared",
    },
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    select: { date: true },
  });
  const previousSession = previousSessionEntry
    ? startOfLocalDay(previousSessionEntry.date)
    : null;

  const [todayHandoff, previousDayHandoff] = await Promise.all([
    buildClientDailyHandoff({
      clientId,
      date: today,
      viewerProviderId: session.providerId,
      viewerRole: session.role,
      currentDate: today,
    }),
    previousSession
      ? buildClientDailyHandoff({
          clientId,
          date: previousSession,
          viewerProviderId: session.providerId,
          viewerRole: session.role,
          currentDate: today,
        })
      : Promise.resolve(null),
  ]);

  if (!todayHandoff && !previousDayHandoff) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    today: todayHandoff,
    previousDay: previousDayHandoff,
  });
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
