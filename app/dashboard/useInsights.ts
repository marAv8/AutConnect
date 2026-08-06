"use client";

import type { InsightCategory } from "@/app/libs/insights/categories";

export type InsightResponse = {
  category?: InsightCategory;
  headline?: string;
  summary: string;
  context?: string;
  trend?: "up" | "down" | "flat";
  answerMode?: "deterministic" | "synthesized" | "insufficient";
  confidence?: "high" | "medium" | "low";
  limitations?: string[];
  evidence?: Array<{
    label: string;
    value: string;
    date?: string;
    sourceId?: string;
  }>;
  supportingData?: {
    providers?: unknown[];
    behaviors?: unknown[];
    sessions?: number;
  };
  error?: string;
};

export function useInsights(clientId: string) {
  const ask = async (question: string, category: InsightCategory) => {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientId, question, category }),
    });

    const data = (await res.json()) as InsightResponse;
    if (!res.ok) {
      throw new Error(data.error ?? "Unable to load insight.");
    }

    return data;
  };

  return { ask };
}
