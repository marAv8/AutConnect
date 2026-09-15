"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";
import { clientDisplayText } from "@/app/libs/clientIdentity";
import { isTeamFocusVisible } from "@/app/libs/teamFocusLifecycle";

export async function updateTeamFocus(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    return { ok: false, reason: "forbidden" as const };
  }

  const clientId = formData.get("clientId")?.toString();
  const title = formData.get("title")?.toString().trim() ?? "";
  const content = formData.get("content")?.toString().trim() ?? "";

  if (!clientId) {
    return { ok: false, reason: "missing_client" as const };
  }

  if (!content) {
    return { ok: false, reason: "missing_content" as const };
  }

  const canEdit = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
      revokedAt: null,
      role: "Supervisor",
    },
    select: {
      id: true,
      client: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!canEdit) {
    return { ok: false, reason: "forbidden" as const };
  }

  const safeTitle = clientDisplayText(
    title,
    canEdit.client.firstName,
    canEdit.client.lastName
  );
  const safeContent = clientDisplayText(
    content,
    canEdit.client.firstName,
    canEdit.client.lastName
  );

  const now = new Date();
  const teamFocus = await db.$transaction(async (tx) => {
    const currentTeamFocus = await tx.teamFocus.findFirst({
      where: {
        clientId,
        isActive: true,
      },
      orderBy: { updatedAt: "desc" },
      select: {
        displayStartedAt: true,
      },
    });
    const displayStartedAt =
      currentTeamFocus &&
      isTeamFocusVisible(currentTeamFocus.displayStartedAt, now)
        ? currentTeamFocus.displayStartedAt
        : now;

    await tx.teamFocus.updateMany({
      where: {
        clientId,
        isActive: true,
      },
      data: { isActive: false },
    });

    return tx.teamFocus.create({
      data: {
        clientId,
        authorId: session.providerId,
        title: safeTitle || null,
        content: safeContent,
        isActive: true,
        displayStartedAt,
      },
      select: {
        id: true,
        title: true,
        content: true,
        displayStartedAt: true,
        createdAt: true,
        updatedAt: true,
        author: {
          select: {
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  });

  revalidatePath("/dashboard");
  return { ok: true as const, teamFocus };
}
