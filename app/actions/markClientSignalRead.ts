"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function markClientSignalRead(input: {
  clientId: string;
  sessionDate: string;
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const sessionDate = new Date(input.sessionDate);
  const assignment = await db.providerClient.findFirst({
    where: {
      clientId: input.clientId,
      providerId: session.providerId,
    },
    select: { id: true },
  });
  if (!assignment) throw new Error("Client access is not available.");

  const currentSessionStart = startOfLocalDay(new Date());
  const latestEntry = await db.entry.findFirst({
    where: {
      clientId: input.clientId,
      date: { lt: currentSessionStart },
      status: "COMPLETED",
      visibility: "Shared",
    },
    orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
    select: { date: true },
  });
  const expectedSessionDate = latestEntry
    ? startOfLocalDay(latestEntry.date)
    : null;
  if (
    Number.isNaN(sessionDate.getTime()) ||
    !expectedSessionDate ||
    sessionDate.getTime() !== expectedSessionDate.getTime()
  ) {
    throw new Error("This client signal is no longer current.");
  }

  await db.clientSignalRead.upsert({
    where: {
      clientId_providerId_sessionDate: {
        clientId: input.clientId,
        providerId: session.providerId,
        sessionDate,
      },
    },
    create: {
      clientId: input.clientId,
      providerId: session.providerId,
      sessionDate,
    },
    update: { readAt: new Date() },
  });

  revalidatePath("/dashboard");
  return { ok: true };
}

function startOfLocalDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}
