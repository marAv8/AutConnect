import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { buildInsight, parseQuestion } from "./insightsEngine";
import { buildInsightContext } from "./insightContext";
import {
  annotateDeterministicInsight,
  contextualQuestionCategory,
  shouldAttemptSynthesis,
} from "./insightAnswerContract";
import { synthesizeInsight } from "./insightSynthesis";
import { isInsightCategory } from "@/app/libs/insights/categories";
import { buildInsightSnapshot } from "./insightSnapshot";
import { restrictedQuestionAnswer } from "./insightQuestionGuard";
import { isInsightLens, type InsightLens } from "../../libs/insights/lenses";
import type { InsightCategory } from "@/app/libs/insights/categories";
import { buildGuardedContextualInsight } from "./guardedContextualInsight";

const CATEGORY_BY_LENS = {
  observations: "overview",
  patterns: "progress",
  context: "overview",
  confidence: "providers",
  significance: "progress",
} as const satisfies Record<InsightLens, InsightCategory>;

async function requireSupervisorSession() {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { session };
}

async function authorizeSupervisorClient(
  session: { providerId: string },
  clientId: string
) {
  const canAccessClient = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
      revokedAt: null,
      role: "Supervisor",
    },
    select: { id: true },
  });

  if (!canAccessClient) {
    return {
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {};
}

async function getInsights(request: Request) {
  const clientId = new URL(request.url).searchParams.get("clientId")?.trim() ?? "";
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const supervisor = await requireSupervisorSession();
  if ("response" in supervisor) return supervisor.response;
  const authorization = await authorizeSupervisorClient(
    supervisor.session,
    clientId
  );
  if ("response" in authorization) return authorization.response;

  const context = await buildInsightContext(
    clientId,
    { intent: "summary" },
    {
      viewerProviderId: supervisor.session.providerId,
      includeCaseSupport: true,
    }
  );
  if (!context) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json(buildInsightSnapshot(context));
}

async function answerInsightQuestion(request: Request) {
  const supervisor = await requireSupervisorSession();
  if ("response" in supervisor) return supervisor.response;

  const body = (await request.json().catch(() => null)) as
    | {
        clientId?: unknown;
        question?: unknown;
        category?: unknown;
        lens?: unknown;
      }
    | null;
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const question = typeof body?.question === "string" ? body.question.trim() : "";
  const fallbackCategory = isInsightCategory(body?.category)
    ? body.category
    : isInsightLens(body?.lens)
      ? CATEGORY_BY_LENS[body.lens]
      : null;
  const category = fallbackCategory
    ? contextualQuestionCategory(question, fallbackCategory)
      : null;
  const lens = isInsightLens(body?.lens) ? body.lens : null;

  if (!clientId || !question || question.length > 500 || !category) {
    return NextResponse.json(
      { error: "clientId, category, and question are required" },
      { status: 400 }
    );
  }

  const authorization = await authorizeSupervisorClient(
    supervisor.session,
    clientId
  );
  if ("response" in authorization) return authorization.response;
  const { session } = supervisor;
  const restricted = restrictedQuestionAnswer(question);
  if (restricted) {
    return NextResponse.json({ ...restricted, category });
  }

  const context = await buildInsightContext(clientId, parseQuestion(question), {
    category,
    viewerProviderId: session.providerId,
  });
  const deterministicBase =
    context && lens && category === CATEGORY_BY_LENS[lens]
      ? buildGuardedContextualInsight(context, lens, question)
      : await buildInsight(clientId, question, {
          category,
          viewerProviderId: session.providerId,
          context,
        });
  const deterministic = annotateDeterministicInsight(
    deterministicBase,
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

function insightsServerError(operation: "load" | "answer", error: unknown) {
  console.error(`Insights failed to ${operation}.`, error);
  return NextResponse.json(
    { error: "Insights could not complete the request. Please try again." },
    { status: 500 }
  );
}

export async function GET(request: Request) {
  try {
    return await getInsights(request);
  } catch (error) {
    return insightsServerError("load", error);
  }
}

export async function POST(request: Request) {
  try {
    return await answerInsightQuestion(request);
  } catch (error) {
    return insightsServerError("answer", error);
  }
}
