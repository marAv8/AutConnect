import type { CaseSupportNotificationType, Prisma } from "@prisma/client";

type CaseSupportNotificationTransaction = Pick<
  Prisma.TransactionClient,
  "caseSupportCase" | "caseSupportNotification" | "providerClient"
>;

export const CASE_SUPPORT_NOTIFICATION_TITLES: Record<
  CaseSupportNotificationType,
  string
> = {
  CASE_UPDATE: "Case update added",
  CLARIFICATION: "Case clarification added",
  CASE_OPENED: "Case opened",
  ACCESS_GRANTED: "Case access updated",
  CASE_RESOLVED: "Case resolved",
};

export function eligibleCaseSupportNotificationRecipientIds({
  ownerSupervisorId,
  activeMemberIds,
  actorId,
}: {
  ownerSupervisorId: string;
  activeMemberIds: string[];
  actorId: string;
}) {
  return [...new Set([ownerSupervisorId, ...activeMemberIds])].filter(
    (providerId) => providerId !== actorId
  );
}

export function caseSupportNotificationAccessWhere(
  recipientId: string
): Prisma.CaseSupportNotificationWhereInput {
  return {
    recipientId,
    NOT: { actorId: recipientId },
    case: {
      client: {
        providerClients: {
          some: { providerId: recipientId, revokedAt: null },
        },
      },
      OR: [
        { ownerSupervisorId: recipientId },
        {
          members: {
            some: { providerId: recipientId, revokedAt: null },
          },
        },
      ],
    },
  };
}

export async function createCaseSupportNotifications(
  tx: CaseSupportNotificationTransaction,
  {
    caseId,
    actorId,
    eventType,
    eventKey,
  }: {
    caseId: string;
    actorId: string;
    eventType: CaseSupportNotificationType;
    eventKey: string;
  }
) {
  const supportCase = await tx.caseSupportCase.findUnique({
    where: { id: caseId },
    select: {
      ownerSupervisorId: true,
      clientId: true,
      members: {
        where: { revokedAt: null },
        select: { providerId: true },
      },
    },
  });

  if (!supportCase) {
    throw new Error("Case Support record not found.");
  }

  const candidateRecipientIds = eligibleCaseSupportNotificationRecipientIds({
    ownerSupervisorId: supportCase.ownerSupervisorId,
    activeMemberIds: supportCase.members.map(({ providerId }) => providerId),
    actorId,
  });
  const activeAssignments = candidateRecipientIds.length
    ? await tx.providerClient.findMany({
        where: {
          clientId: supportCase.clientId,
          providerId: { in: candidateRecipientIds },
          revokedAt: null,
        },
        select: { providerId: true },
      })
    : [];
  const activeRecipientIds = new Set(
    activeAssignments.map(({ providerId }) => providerId)
  );
  const recipientIds = candidateRecipientIds.filter((providerId) =>
    activeRecipientIds.has(providerId)
  );

  if (recipientIds.length === 0) return;

  await tx.caseSupportNotification.createMany({
    data: recipientIds.map((recipientId) => ({
      caseId,
      recipientId,
      actorId,
      eventType,
      eventKey,
    })),
    skipDuplicates: true,
  });
}
