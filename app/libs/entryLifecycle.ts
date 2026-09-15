import { EntryStatus } from "@prisma/client";

export function statusAfterEntrySave(
  existingStatus: EntryStatus | null | undefined,
  revisionCount: number,
  completeOnSave = false
) {
  return completeOnSave ||
    existingStatus === EntryStatus.COMPLETED ||
    revisionCount > 0
    ? EntryStatus.COMPLETED
    : EntryStatus.IN_PROGRESS;
}
