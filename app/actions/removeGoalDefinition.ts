"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function removeGoalDefinition(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const clientId = formData.get("clientId")?.toString();
  const goalId = formData.get("goalId")?.toString();

  if (!clientId || !goalId) {
    return { ok: false, reason: "missing_data" as const };
  }

  await db.goalDefinition.updateMany({
    where: {
      id: goalId,
      clientId,
      providerId: session.providerId,
    },
    data: {
      isActive: false,
    },
  });

  return { ok: true };
}
