/**
 * Pure local projections used after notes are read or saved from an overlay.
 * These helpers update the visible carousel immediately while server refreshes
 * remain responsible for the durable dashboard state.
 */

import type {
  DashboardClient,
  DashboardEntryMutation,
} from "./dashboardClientTypes";

export function applyDashboardEntryMutations(
  clients: DashboardClient[],
  mutations: DashboardEntryMutation[],
  currentProviderId: string
) {
  return mutations.reduce((currentClients, mutation) => {
    if (mutation.type === "read") {
      return markDashboardProviderEntriesRead(
        currentClients,
        mutation.clientId,
        mutation.authorProviderId,
        mutation.entryIds
      );
    }

    return projectDashboardEntrySaved(
      currentClients,
      mutation.clientId,
      mutation.authorProviderId,
      mutation.entryId,
      mutation.kind,
      mutation.visibility,
      mutation.status,
      currentProviderId
    );
  }, clients);
}

export function markDashboardProviderEntriesRead(
  clients: DashboardClient[],
  clientId: string,
  authorProviderId: string,
  entryIds: readonly string[]
) {
  const readAt = new Date();
  const presentedEntryIds = new Set(entryIds);

  return clients.map((client) => {
    if (client.id !== clientId) return client;

    return {
      ...client,
      entries: client.entries?.map((entry) =>
        entry.providerId === authorProviderId && presentedEntryIds.has(entry.id)
          ? { ...entry, reads: [{ readAt }] }
          : entry
      ),
    };
  });
}

export function projectDashboardEntrySaved(
  clients: DashboardClient[],
  clientId: string,
  authorProviderId: string,
  entryId: string,
  kind: string | undefined,
  visibility: string | undefined,
  status: string | undefined,
  currentProviderId: string
) {
  return clients.map((client) => {
    if (client.id !== clientId) return client;

    const entries = client.entries ?? [];
    const hasEntry = entries.some((entry) => entry.id === entryId);
    const authorReadAt =
      authorProviderId === currentProviderId ? new Date() : null;
    const nextEntry = {
      id: entryId,
      providerId: authorProviderId,
      kind,
      visibility,
      status,
      completedAt: status === "COMPLETED" ? new Date() : null,
      reads: visibility === "Private" ? [] : [{ readAt: authorReadAt }],
    };

    return {
      ...client,
      entries: hasEntry
        ? entries.map((entry) =>
            entry.id === entryId
              ? {
                  ...entry,
                  providerId: authorProviderId,
                  kind: kind ?? entry.kind,
                  visibility: visibility ?? entry.visibility,
                  status: status ?? entry.status,
                  completedAt:
                    status === "COMPLETED" ? new Date() : entry.completedAt,
                  reads:
                    visibility === "Private"
                      ? []
                      : authorProviderId === currentProviderId
                        ? [{ readAt: authorReadAt }]
                        : entry.reads,
                }
              : entry
          )
        : [...entries, nextEntry],
      recentEntries: mergeRecentEntry(
        client.recentEntries ?? [],
        entryId,
        authorProviderId,
        status
      ),
    };
  });
}

function mergeRecentEntry(
  recentEntries: NonNullable<DashboardClient["recentEntries"]>,
  entryId: string,
  providerId: string,
  status?: string
) {
  if (recentEntries.some((entry) => entry.id === entryId)) {
    return recentEntries;
  }

  return [...recentEntries, { id: entryId, providerId, status }];
}
