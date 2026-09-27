import { db } from "@/lib/db";
import { EntryVisibility } from "@prisma/client";

type SyncEntryReadsAfterAuthorSaveInput = {
  entryId: string;
  authorProviderId: string;
  assignedProviderIds: string[];
  visibility?: EntryVisibility;
  reactivateForTeammates?: boolean;
};

/**
 * Every save acknowledges the author and adds missing rows for active
 * assignees. Only a published completion/update opts into resetting teammate
 * rows; draft persistence leaves their existing acknowledgements untouched.
 */
export async function syncEntryReadsAfterAuthorSave({
  entryId,
  authorProviderId,
  assignedProviderIds,
  visibility = EntryVisibility.Shared,
  reactivateForTeammates = false,
}: SyncEntryReadsAfterAuthorSaveInput) {
  if (visibility === EntryVisibility.Private) {
    await db.entryRead.deleteMany({ where: { entryId } });
    return;
  }

  const providerIds = [...new Set(assignedProviderIds)];
  if (providerIds.length === 0) return;

  const acknowledgedAt = new Date();
  await db.$transaction(async (tx) => {
    await tx.entryRead.createMany({
      data: providerIds.map((providerId) => ({
        entryId,
        providerId,
        readAt: providerId === authorProviderId ? acknowledgedAt : null,
      })),
      skipDuplicates: true,
    });

    if (providerIds.includes(authorProviderId)) {
      await tx.entryRead.updateMany({
        where: { entryId, providerId: authorProviderId },
        data: { readAt: acknowledgedAt },
      });
    }

    if (reactivateForTeammates) {
      await tx.entryRead.updateMany({
        where: {
          entryId,
          providerId: { in: providerIds, not: authorProviderId },
        },
        data: { readAt: null },
      });
    }
  });
}
