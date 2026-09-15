"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isTeamFocusVisible } from "@/app/libs/teamFocusLifecycle";

export async function getCurrentTeamFocusVersion(clientId: string) {
  const session = await getSession();
  if (!session || !clientId) return null;

  const assignment = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
      revokedAt: null,
    },
    select: { id: true },
  });
  if (!assignment) return null;

  const teamFocus = await db.teamFocus.findFirst({
    where: {
      clientId,
      isActive: true,
    },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      displayStartedAt: true,
      updatedAt: true,
    },
  });

  if (!teamFocus || !isTeamFocusVisible(teamFocus.displayStartedAt)) {
    return null;
  }

  return `${teamFocus.id}:${teamFocus.updatedAt.toISOString()}`;
}
