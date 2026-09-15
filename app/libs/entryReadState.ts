import { db } from "@/lib/db";
import { EntryVisibility } from "@prisma/client";

type SyncEntryReadsAfterAuthorSaveInput = {
  entryId: string;
  authorProviderId: string;
  assignedProviderIds: string[];
  visibility?: EntryVisibility;
};

/**
 * A save acknowledges the author without changing any teammate's existing
 * read state. Missing rows are added for active assignees, while the compound
 * EntryRead key keeps same-day updates retry-safe.
 */
export async function syncEntryReadsAfterAuthorSave({
  entryId,
  authorProviderId,
  assignedProviderIds,
  visibility = EntryVisibility.Shared,
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
  });
}
