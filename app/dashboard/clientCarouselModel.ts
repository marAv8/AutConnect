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
      return updateClientEntriesReadState(
        currentClients,
        mutation.clientId,
        mutation.authorProviderId
      );
    }

    return updateClientEntrySavedState(
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

function updateClientEntriesReadState(
  clients: DashboardClient[],
  clientId: string,
  authorProviderId: string
) {
  const readAt = new Date();

  return clients.map((client) => {
    if (client.id !== clientId) return client;

    return {
      ...client,
      entries: client.entries?.map((entry) =>
        entry.providerId === authorProviderId
          ? { ...entry, reads: [{ readAt }] }
          : entry
      ),
    };
  });
}

function updateClientEntrySavedState(
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
    const nextEntry = {
      id: entryId,
      providerId: authorProviderId,
      kind,
      visibility,
      status,
      reads: visibility === "Private" ? [] : [{ readAt: null }],
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
                  reads:
                    visibility === "Private"
                      ? []
                      : authorProviderId === currentProviderId
                        ? [{ readAt: null }]
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
