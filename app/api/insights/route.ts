import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { buildInsight, parseQuestion } from "./insightsEngine";
import { buildInsightContext } from "./insightContext";
import {
  annotateDeterministicInsight,
  shouldAttemptSynthesis,
} from "./insightAnswerContract";
import { synthesizeInsight } from "./insightSynthesis";
import { isInsightCategory } from "@/app/libs/insights/categories";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | { clientId?: unknown; question?: unknown; category?: unknown }
    | null;
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const category = isInsightCategory(body?.category) ? body.category : null;

  if (!clientId || !question || !category) {
    return NextResponse.json(
      { error: "clientId, category, and question are required" },
      { status: 400 }
    );
  }

  const canAccessClient = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
      role: "Supervisor",
    },
    select: { id: true },
  });

  if (!canAccessClient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const context = await buildInsightContext(clientId, parseQuestion(question), {
    category,
    viewerProviderId: session.providerId,
  });
  const deterministic = annotateDeterministicInsight(
    await buildInsight(clientId, question, {
      category,
      viewerProviderId: session.providerId,
      context,
    }),
    question,
    category
  );

  if (
    context &&
    shouldAttemptSynthesis(question, category, deterministic)
  ) {
    const synthesized = await synthesizeInsight({
      question,
      category,
      context,
      deterministic,
      viewerProviderId: session.providerId,
    });
    if (synthesized) {
      return NextResponse.json(synthesized);
    }
  }

  return NextResponse.json(deterministic);
}
