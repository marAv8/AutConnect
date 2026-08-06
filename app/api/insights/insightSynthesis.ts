import { createHash } from "node:crypto";
import { z } from "zod";
import type { InsightCategory } from "@/app/libs/insights/categories";
import type { InsightContext } from "./insightContext";
import type { InsightResult } from "./insightsEngine";

type SourceItem = {
  id: string;
  label: string;
  value: string;
  date?: string;
};

type SynthesisInput = {
  question: string;
  category: InsightCategory;
  context: InsightContext;
  deterministic: InsightResult;
  viewerProviderId: string;
};

const synthesisSchema = z.object({
  headline: z.string().min(1).max(120),
  summary: z.string().min(1).max(900),
  confidence: z.enum(["high", "medium", "low"]),
  limitations: z.array(z.string().max(240)).max(4),
  sourceIds: z.array(z.string()).max(8),
});

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    Supervisor: "BCBA",
    SpeechPathologist: "SLP",
    OccupationalTherapist: "OT",
    BehaviorTherapist: "Behavior Tech",
    Educator: "Educator",
    Caregiver: "Caregiver",
  };
  return labels[role] ?? "Provider";
}

function buildAliases(context: InsightContext) {
  const counts = new Map<string, number>();
  return new Map(
    context.careTeam.map((provider) => {
      const role = roleLabel(provider.assignmentRole || provider.accountRole);
      const count = (counts.get(role) ?? 0) + 1;
      counts.set(role, count);
      return [provider.providerId, `${role} ${count}`];
    })
  );
}

function deidentifyText(
  value: string | null | undefined,
  context: InsightContext,
  aliases: Map<string, string>
) {
  let result = value ?? "";
  const clientName = `${context.client.firstName} ${context.client.lastName}`.trim();
  for (const candidate of [
    clientName,
    context.client.firstName,
    context.client.lastName,
  ]) {
    if (candidate) {
      result = result.replaceAll(candidate, "the client");
    }
  }
  for (const provider of context.careTeam) {
    const alias = aliases.get(provider.providerId) ?? "Provider";
    if (provider.providerName) {
      result = result.replaceAll(provider.providerName, alias);
    }
  }
  return result;
}

function buildSourceCatalog(
  category: InsightCategory,
  context: InsightContext,
  aliases: Map<string, string>
) {
  const sources: SourceItem[] = [];
  const add = (label: string, value: string, date?: string) => {
    if (!value.trim() || sources.length >= 12) return;
    sources.push({
      id: `S${sources.length + 1}`,
      label,
      value: deidentifyText(value, context, aliases).slice(0, 900),
      date,
    });
  };

  if (category === "overview") {
    if (context.currentTeamFocus) {
      add(
        "Current team focus",
        [
          context.currentTeamFocus.title,
          context.currentTeamFocus.content,
        ]
          .filter(Boolean)
          .join(": "),
        context.currentTeamFocus.updatedAt
      );
    }
    add(
      "Accessible record totals",
      `${context.sessions.length} completed sessions; ${context.careTeam.length} assigned providers; ${context.caseSupport.requests.length} case-support requests; ${context.caseSupport.cases.length} case-support cases.`
    );
    context.sessions.slice(-6).forEach((session) => {
      const alias = aliases.get(session.providerId) ?? roleLabel(session.provider.role);
      add(
        `${alias} session`,
        [
          session.note,
          ...session.items.slice(0, 4).map((item) =>
            `${item.target}: ${item.rawValue ?? item.score ?? "recorded"}`
          ),
        ]
          .filter(Boolean)
          .join("; "),
        session.date.toISOString()
      );
    });
  } else if (category === "progress") {
    context.sessions.slice(-10).forEach((session) => {
      const alias = aliases.get(session.providerId) ?? roleLabel(session.provider.role);
      add(
        `${alias} progress`,
        session.items
          .slice(0, 6)
          .map(
            (item) =>
              `${item.target}: normalized score ${item.normalizedScore ?? "not scored"}`
          )
          .join("; "),
        session.date.toISOString()
      );
    });
  } else if (category === "providers") {
    context.careTeam.forEach((provider) => {
      const alias = aliases.get(provider.providerId) ?? roleLabel(provider.assignmentRole);
      const sessions = context.sessions.filter(
        (session) => session.providerId === provider.providerId
      );
      const targets = Array.from(
        new Set(
          sessions.flatMap((session) =>
            session.items.map((item) => item.target).filter(Boolean)
          )
        )
      ).slice(0, 8);
      add(
        alias,
        `${sessions.length} completed sessions. Recorded targets: ${
          targets.join(", ") || "none"
        }.`
      );
    });
  } else if (category === "documentation") {
    context.documentationRecords.slice(-10).forEach((record) => {
      const alias = aliases.get(record.providerId) ?? roleLabel(record.providerRole);
      add(
        `${alias} ${record.kind}`,
        [
          record.note,
          record.clinicalReflection,
          ...record.observations.map(
            (observation) => `${observation.target}: ${observation.observation}`
          ),
          record.revisions.length
            ? `${record.revisions.length} preserved revision(s)`
            : null,
        ]
          .filter(Boolean)
          .join("; "),
        record.completedAt ?? record.date
      );
    });
  } else {
    context.caseSupport.requests.slice(-6).forEach((request) => {
      add(
        "Case-support request",
        `Concern: ${request.concern}; requested support: ${request.requestedSupport}; status: ${request.status}; response: ${request.responseNote ?? "none"}.`,
        request.updatedAt
      );
    });
    context.caseSupport.cases.slice(-4).forEach((caseRecord) => {
      add(
        "Case-support case",
        `Title: ${caseRecord.title}; concern: ${caseRecord.concern}; desired outcome: ${caseRecord.desiredOutcome}; status: ${caseRecord.status}; documentation entries: ${caseRecord.entries.length}; coordination entries: ${caseRecord.coordinations.length}.`,
        caseRecord.updatedAt
      );
    });
  }

  return sources;
}

function responseText(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (
        part &&
        typeof part === "object" &&
        typeof (part as { text?: unknown }).text === "string"
      ) {
        return (part as { text: string }).text;
      }
    }
  }
  return null;
}

function safetyIdentifier(providerId: string) {
  const secret = process.env.NEXTAUTH_SECRET ?? "local-insights";
  return createHash("sha256")
    .update(`${secret}:${providerId}`)
    .digest("hex")
    .slice(0, 32);
}

export function isInsightSynthesisEnabled() {
  return (
    process.env.INSIGHTS_AI_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY)
  );
}

export async function synthesizeInsight(
  input: SynthesisInput,
  fetchImpl: typeof fetch = fetch
): Promise<InsightResult | null> {
  if (!isInsightSynthesisEnabled()) return null;

  const aliases = buildAliases(input.context);
  const sources = buildSourceCatalog(input.category, input.context, aliases);
  if (sources.length === 0) return null;

  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_INSIGHTS_MODEL ?? "gpt-5.6-terra",
        store: false,
        safety_identifier: safetyIdentifier(input.viewerProviderId),
        reasoning: { effort: "low" },
        instructions:
          "You synthesize supervisor-facing care-team records. Use only the supplied category evidence. Do not diagnose, infer causation, assign blame, or recommend treatment. Distinguish an observed pattern from an explanation. If evidence is insufficient, say so. Cite only the supplied source IDs. Keep the answer concise.",
        input: JSON.stringify({
          category: input.category,
          question: deidentifyText(input.question, input.context, aliases),
          structuredAnswer: {
            headline: deidentifyText(
              input.deterministic.headline,
              input.context,
              aliases
            ),
            summary: deidentifyText(
              input.deterministic.summary,
              input.context,
              aliases
            ),
          },
          sources,
        }),
        text: {
          format: {
            type: "json_schema",
            name: "supervisor_insight",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: [
                "headline",
                "summary",
                "confidence",
                "limitations",
                "sourceIds",
              ],
              properties: {
                headline: { type: "string" },
                summary: { type: "string" },
                confidence: {
                  type: "string",
                  enum: ["high", "medium", "low"],
                },
                limitations: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 4,
                },
                sourceIds: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 8,
                },
              },
            },
          },
        },
      }),
    });

    if (!response.ok) return null;
    const text = responseText(await response.json());
    if (!text) return null;
    const parsed = synthesisSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return null;

    const cited = new Set(parsed.data.sourceIds);
    const evidence = sources
      .filter((source) => cited.has(source.id))
      .slice(0, 8)
      .map(({ id, ...source }) => ({ ...source, sourceId: id }));

    return {
      ...input.deterministic,
      headline: parsed.data.headline,
      summary: parsed.data.summary,
      answerMode: "synthesized",
      confidence: evidence.length ? parsed.data.confidence : "low",
      limitations: evidence.length
        ? parsed.data.limitations
        : [
            ...parsed.data.limitations,
            "The synthesized answer did not cite a supplied record.",
          ],
      evidence,
    };
  } catch {
    return null;
  }
}
