import type { DashboardEntryState } from "./dashboardClientTypes";
import { providerNoteSignalDayKey } from "../libs/providerNoteSignalDay";

type ProviderSignalStateInput = {
  entries: DashboardEntryState[];
  isCurrentProvider: boolean;
  locallyCompleted: boolean;
  signalDayKey?: string;
};

export function providerSignalState({
  entries,
  isCurrentProvider,
  locallyCompleted,
  signalDayKey = providerNoteSignalDayKey(new Date()),
}: ProviderSignalStateInput) {
  const completedEntries = entries.filter(
    (entry) =>
      entry.status === "COMPLETED" &&
      (!entry.completedAt ||
        providerNoteSignalDayKey(entry.completedAt) === signalDayKey)
  );
  const hasCompletedNote = locallyCompleted || completedEntries.length > 0;
  const hasUnreadNote =
    completedEntries.length > 0
      ? completedEntries.some(isDashboardEntryUnread)
      : locallyCompleted;
  const showSignal = isCurrentProvider
    ? hasCompletedNote && hasUnreadNote
    : hasCompletedNote;

  return {
    completedEntryIds: completedEntries.map((entry) => entry.id).sort(),
    completedEntryVersions: completedEntries
      .map((entry) => `${entry.id}:${entry.completedAt ?? "current"}`)
      .sort(),
    hasCompletedNote,
    hasUnreadNote,
    showSignal,
    isSignalDimmed: !isCurrentProvider && showSignal && !hasUnreadNote,
    showAction: isCurrentProvider || showSignal,
  };
}

export function isDashboardEntryUnread(entry: DashboardEntryState) {
  if (entry.visibility === "Private") return false;

  return (
    !entry.reads ||
    entry.reads.length === 0 ||
    entry.reads.some((read) => read.readAt === null)
  );
}
