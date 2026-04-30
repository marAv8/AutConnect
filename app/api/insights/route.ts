import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { buildInsight } from "./insightsEngine";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { clientId?: unknown; question?: unknown }
    | null;
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";

  if (!clientId || !question) {
    return NextResponse.json(
      { error: "clientId and question are required" },
      { status: 400 }
    );
  }

  const canAccessClient = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
    },
    select: { id: true },
  });

  if (!canAccessClient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const insight = await buildInsight(clientId, question);
  return NextResponse.json(insight);
}
