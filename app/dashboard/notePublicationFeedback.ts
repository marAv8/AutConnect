type PublicationEvent = {
  clientId: string;
  authorProviderId: string;
  completedEntryIds: string[];
};

/**
 * Claims one author-facing announcement for a successful publication event.
 * The caller remains responsible for invoking this only after the completion
 * server action succeeds.
 */
export function claimPublicationAnnouncement(
  announcedEvents: Set<string>,
  event: PublicationEvent
) {
  if (!event.clientId || event.completedEntryIds.length === 0) {
    return false;
  }

  const eventKey = [
    event.clientId,
    event.authorProviderId,
    ...new Set(event.completedEntryIds),
  ]
    .sort()
    .join(":");

  if (announcedEvents.has(eventKey)) {
    return false;
  }

  announcedEvents.add(eventKey);
  return true;
}
