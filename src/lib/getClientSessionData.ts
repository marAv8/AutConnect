import { db } from "@/lib/db";

export async function getClientSessionData(clientId: string) {
  const entries = await db.entry.findMany({
    where: { clientId },
    orderBy: { date: "desc" },
    take: 7,
    include: {
      items: {
        orderBy: {
          createdAt: "asc",
        },
      },
      provider: {
        select: {
          role: true,
        },
      },
      reads: true,
    },
  });

  return entries.map((entry) => ({
    note: entry.note,
    finalScore: entry.finalScore,
    providerRole: entry.provider.role,
    items: entry.items.map((item) => ({
      target: item.target,
      goal: item.goal,
      score: item.score,
      metricType: item.metricType,
      rawValue: item.rawValue,
      supportLevel: item.supportLevel,
    })),
  }));
}
