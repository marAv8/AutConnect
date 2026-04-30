"use client";

export type InsightResponse = {
  summary: string;
  trend?: "up" | "down" | "flat";
  supportingData?: {
    providers?: unknown[];
    behaviors?: unknown[];
    sessions?: number;
  };
  error?: string;
};

export function useInsights(clientId: string) {
  const ask = async (question: string) => {
    const res = await fetch("/api/insights", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ clientId, question }),
    });

    const data = (await res.json()) as InsightResponse;
    if (!res.ok) {
      throw new Error(data.error ?? "Unable to load insight.");
    }

    return data;
  };

  return { ask };
}
