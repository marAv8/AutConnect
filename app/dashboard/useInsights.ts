"use client";

import { useCallback } from "react";
import type { InsightCategory } from "@/app/libs/insights/categories";
import type { InsightLens } from "@/app/libs/insights/lenses";
import type { InsightSnapshot } from "@/app/api/insights/insightSnapshotContract";

export type { InsightSnapshot } from "@/app/api/insights/insightSnapshotContract";

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

async function readInsightsResponse<T extends { error?: string }>(
  response: Response,
  fallbackError: string
): Promise<T> {
  let responseText = "";
  try {
    responseText = await response.text();
  } catch {
    throw new Error(fallbackError);
  }

  if (!responseText.trim()) {
    throw new Error(fallbackError);
  }

  let data: T;
  try {
    data = JSON.parse(responseText) as T;
  } catch {
    throw new Error(fallbackError);
  }

  if (!response.ok) {
    throw new Error(data.error ?? fallbackError);
  }

  return data;
}

export function useInsights(clientId: string) {
  const loadSnapshot = useCallback(async () => {
    const res = await fetch(
      `/api/insights?clientId=${encodeURIComponent(clientId)}`,
      { method: "GET" }
    );
    return readInsightsResponse<InsightSnapshot & { error?: string }>(
      res,
      "Insights could not complete the request. Please refresh and try again."
    );
  }, [clientId]);

  const ask = useCallback(async (question: string, lens: InsightLens) => {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientId, question, lens }),
    });

    return readInsightsResponse<InsightResponse>(
      res,
      "Insights could not complete the request. Please try again."
    );
  }, [clientId]);

  return { ask, loadSnapshot };
}
