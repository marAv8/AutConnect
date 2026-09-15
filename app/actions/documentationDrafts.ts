"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { Prisma } from "@prisma/client";

export async function saveDocumentationDraft(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const clientId = formData.get("clientId")?.toString();
  const workflowKey = formData.get("workflowKey")?.toString();
  const dataValue = formData.get("data");

  if (!clientId || !workflowKey || typeof dataValue !== "string") {
    return { ok: false, reason: "invalid_data" as const };
  }

  const hasAccess = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
      revokedAt: null,
    },
    select: { id: true },
  });

  if (!hasAccess) {
    return { ok: false, reason: "forbidden" as const };
  }

  let data: Prisma.InputJsonValue;
  try {
    const parsed = JSON.parse(dataValue) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, reason: "invalid_data" as const };
    }
    data = parsed as Prisma.InputJsonValue;
  } catch {
    return { ok: false, reason: "invalid_data" as const };
  }

  const draft = await db.documentationDraft.upsert({
    where: {
      providerId_clientId_workflowKey: {
        providerId: session.providerId,
        clientId,
        workflowKey,
      },
    },
    create: {
      providerId: session.providerId,
      clientId,
      workflowKey,
      data,
    },
    update: {
      data,
    },
    select: {
      updatedAt: true,
    },
  });

  return { ok: true, updatedAt: draft.updatedAt.toISOString() };
}

export async function clearDocumentationDraft(formData: FormData) {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const clientId = formData.get("clientId")?.toString();
  const workflowKey = formData.get("workflowKey")?.toString();

  if (!clientId || !workflowKey) {
    return { ok: false, reason: "invalid_data" as const };
  }

  await db.documentationDraft.deleteMany({
    where: {
      providerId: session.providerId,
      clientId,
      workflowKey,
    },
  });

  return { ok: true };
}
