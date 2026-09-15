export const INSIGHT_LENSES = [
  "observations",
  "patterns",
  "context",
  "confidence",
  "significance",
] as const;

export type InsightLens = (typeof INSIGHT_LENSES)[number];

export function isInsightLens(value: unknown): value is InsightLens {
  return (
    typeof value === "string" &&
    INSIGHT_LENSES.includes(value as InsightLens)
  );
}

export const INSIGHT_LENS_LABELS: Record<InsightLens, string> = {
  observations: "Observations",
  patterns: "Patterns",
  context: "Context",
  confidence: "Confidence",
  significance: "Significance",
};
