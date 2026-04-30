"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";

export async function markEntriesRead(params: {
  clientId: string;
  authorProviderId: string;
}) {
  // 1. Auth
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const { clientId, authorProviderId } = params;

  // 2. Mark unread entries as read FOR THIS PROVIDER ONLY
  await db.entryRead.updateMany({
    where: {
      providerId: session.providerId, // the reader
      readAt: null,
      entry: {
        clientId,
        providerId: authorProviderId, // the author being viewed
      },
    },
    data: {
      readAt: new Date(),
    },
  });

  return { ok: true };
}
