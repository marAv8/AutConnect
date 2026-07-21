"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { revalidatePath } from "next/cache";

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
      role: "Supervisor",
    },
    select: { id: true },
  });

  if (!canEdit) {
    return { ok: false, reason: "forbidden" as const };
  }

  const teamFocus = await db.$transaction(async (tx) => {
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
        title: title || null,
        content,
        isActive: true,
      },
      select: {
        id: true,
        title: true,
        content: true,
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
