export const INSIGHT_CATEGORIES = [
  "overview",
  "progress",
  "providers",
  "documentation",
  "caseSupport",
] as const;

export type InsightCategory = (typeof INSIGHT_CATEGORIES)[number];

export type InsightCategoryDefinition = {
  id: InsightCategory;
  label: string;
  description: string;
  placeholder: string;
};

export const INSIGHT_CATEGORY_DEFINITIONS: InsightCategoryDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Current focus and recent client picture",
    placeholder: "Ask for a concise overview",
  },
  {
    id: "progress",
    label: "Progress",
    description: "Goals, targets, domains, and trends",
    placeholder: "Ask about progress or a tracked area",
  },
  {
    id: "providers",
    label: "Providers",
    description: "Individual and interdisciplinary contributions",
    placeholder: "Ask about a provider or care-team pattern",
  },
  {
    id: "documentation",
    label: "Documentation",
    description: "Completed notes, authors, and revisions",
    placeholder: "Ask who documented or what changed",
  },
  {
    id: "caseSupport",
    label: "Case Support",
    description: "Requests, records, access, and coordination",
    placeholder: "Ask about a case-support record",
  },
];

export function isInsightCategory(value: unknown): value is InsightCategory {
  return (
    typeof value === "string" &&
    INSIGHT_CATEGORIES.includes(value as InsightCategory)
  );
}
