import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { buildInsightContext } from "../insightContext";
import type { ParsedInsightQuestion } from "../insightsEngine";

const DEBUG_FLAG = "INSIGHT_CONTEXT_DEBUG";

function isDebugContextEnabled() {
  return process.env.NODE_ENV === "development" || process.env[DEBUG_FLAG] === "true";
}

const debugParsedQuestion: ParsedInsightQuestion = {
  intent: "summary",
  context: ["debug-preview"],
};

export async function GET(request: Request) {
  if (!isDebugContextEnabled()) {
    return NextResponse.json(
      { error: `Insight context debug preview is disabled. Set ${DEBUG_FLAG}=true to enable it.` },
      { status: 404 }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const clientId = searchParams.get("clientId") ?? "";

  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
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

  const insightContext = await buildInsightContext(clientId, debugParsedQuestion);

  if (!insightContext) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return new Response(JSON.stringify(insightContext, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
