import { createHash } from "node:crypto";
import { z } from "zod";
import type {
  SignalEntry,
  SignalSemanticEvidence,
} from "@/app/libs/clientSignal/types";

type SemanticInput = {
  entries: SignalEntry[];
  viewerProviderId: string;
  redactTerms?: string[];
};

const semanticSchema = z.object({
  evidence: z.array(z.object({
    entryId: z.string().min(1),
    positiveChange: z.enum(["none", "possible", "clear"]),
    supportConcern: z.enum(["none", "possible", "clear"]),
    seriousBehavior: z.enum(["none", "possible", "clear"]),
    interventionContext: z.string().max(320).nullable(),
    rationale: z.string().min(1).max(360),
  })).max(60),
});

export function isClientSignalSemanticsEnabled() {
  return (
    process.env.CLIENT_SIGNAL_AI_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY)
  );
}

export async function interpretClientSignalEvidence(
  input: SemanticInput,
  fetchImpl: typeof fetch = fetch
): Promise<SignalSemanticEvidence[]> {
  if (!isClientSignalSemanticsEnabled() || input.entries.length === 0) return [];

  const permittedIds = new Set(input.entries.map((entry) => entry.id));
  const records = input.entries.slice(-60).map((entry) => ({
    entryId: entry.id,
    providerRole: entry.providerRole,
    recordedAt: toDate(entry.date).toISOString(),
    note: redact(entry.note, input.redactTerms),
    measurements: entry.items.map((item) => ({
      target: redact(item.target, input.redactTerms),
      goal: redact(item.goal, input.redactTerms),
      score: item.score ?? null,
      rawValue: item.rawValue ?? null,
      metricType: item.metricType ?? null,
      measurementProfile: item.measurementProfile ?? null,
      observation: redact(item.observation, input.redactTerms),
    })),
    abcObservations: entry.abcObservations.map((abc) => ({
      antecedent: redact(abc.antecedent, input.redactTerms),
      behavior: redact(abc.behavior, input.redactTerms),
      consequence: redact(abc.consequence, input.redactTerms),
    })),
  }));

  try {
    const response = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_CLIENT_SIGNAL_MODEL ?? "gpt-5.6-terra",
        store: false,
        safety_identifier: safetyIdentifier(input.viewerProviderId),
        reasoning: { effort: "low" },
        instructions: [
          "Extract objective semantic evidence from care-team records.",
          "Use only the supplied records. Never select a color or priority.",
          "Do not diagnose, infer causation, assign blame, or recommend treatment.",
          "Normalize informal wording into observable, neutral evidence.",
          "Positive change must be a meaningful change or unusually strong session, not generic praise.",
          "Intervention context must name an explicitly documented condition, support, or event that may help the team study the change.",
          "Serious behavior must be explicitly documented; do not infer it from prompting level alone.",
          "Return one evidence object per supplied entry, preserving its entryId.",
        ].join(" "),
        input: JSON.stringify({ records }),
        text: {
          format: {
            type: "json_schema",
            name: "client_signal_semantic_evidence",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["evidence"],
              properties: {
                evidence: {
                  type: "array",
                  maxItems: 60,
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: [
                      "entryId",
                      "positiveChange",
                      "supportConcern",
                      "seriousBehavior",
                      "interventionContext",
                      "rationale",
                    ],
                    properties: {
                      entryId: { type: "string" },
                      positiveChange: {
                        type: "string",
                        enum: ["none", "possible", "clear"],
                      },
                      supportConcern: {
                        type: "string",
                        enum: ["none", "possible", "clear"],
                      },
                      seriousBehavior: {
                        type: "string",
                        enum: ["none", "possible", "clear"],
                      },
                      interventionContext: { type: ["string", "null"] },
                      rationale: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (!response.ok) return [];
    const text = responseText(await response.json());
    if (!text) return [];
    const parsed = semanticSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return [];
    return parsed.data.evidence.filter((evidence) => permittedIds.has(evidence.entryId));
  } catch {
    return [];
  }
}

function redact(value: string | null | undefined, terms: string[] = []) {
  let result = value ?? "";
  for (const term of terms.filter(Boolean).sort((a, b) => b.length - a.length)) {
    result = result.replaceAll(term, "the client");
  }
  return result;
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
  const secret = process.env.NEXTAUTH_SECRET ?? "local-client-signals";
  return createHash("sha256")
    .update(`${secret}:${providerId}`)
    .digest("hex")
    .slice(0, 32);
}

function toDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}
