import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
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
  const previousDay = new Date(today);
  previousDay.setDate(previousDay.getDate() - 1);

  const [todayHandoff, previousDayHandoff] = await Promise.all([
    buildClientDailyHandoff({
      clientId,
      date: today,
      viewerProviderId: session.providerId,
      viewerRole: session.role,
      currentDate: today,
    }),
    buildClientDailyHandoff({
      clientId,
      date: previousDay,
      viewerProviderId: session.providerId,
      viewerRole: session.role,
      currentDate: today,
    }),
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
