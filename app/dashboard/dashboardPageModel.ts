import { clientDisplayText } from "../libs/clientIdentity";
import type { ClientSignalSnapshot } from "../libs/clientSignal";
import { isTeamFocusVisible } from "../libs/teamFocusLifecycle";
import type {
  DashboardClient,
  DashboardEntryState,
  DashboardProviderClient,
  DashboardTeamFocusRevision,
} from "./dashboardClientTypes";

type DashboardPageTeamFocusRecord = DashboardTeamFocusRevision & {
  isActive: boolean;
};

export type DashboardPageClientRecord = {
  id: string;
  firstName: string;
  lastName: string;
  providerClients: DashboardProviderClient[];
  entries: DashboardEntryState[];
  teamFocusItems: DashboardPageTeamFocusRecord[];
  caseSupportCases: Array<{ id: string }>;
};

export type DashboardPageRecentEntryRecord = {
  id: string;
  clientId: string;
  providerId: string;
  status?: string;
};

type PrepareDashboardClientsInput = {
  clients: DashboardPageClientRecord[];
  recentEntries: DashboardPageRecentEntryRecord[];
  clientSignals: ReadonlyMap<string, ClientSignalSnapshot>;
  viewerProviderId: string;
  viewerRole: string;
  now: Date;
};

/**
 * Builds the serializable Client view model after all Dashboard reads finish.
 * Input ordering is retained because it drives the Client grid and Provider orbit.
 */
export function prepareDashboardClients({
  clients,
  recentEntries,
  clientSignals,
  viewerProviderId,
  viewerRole,
  now,
}: PrepareDashboardClientsInput): DashboardClient[] {
  const recentEntriesByClientId = new Map<
    string,
    Array<{ id: string; providerId: string; status?: string }>
  >();

  for (const entry of recentEntries) {
    const existing = recentEntriesByClientId.get(entry.clientId);
    const recentEntry = {
      id: entry.id,
      providerId: entry.providerId,
      status: entry.status,
    };

    if (existing) {
      existing.push(recentEntry);
    } else {
      recentEntriesByClientId.set(entry.clientId, [recentEntry]);
    }
  }

  return clients.map((client) => {
    const { caseSupportCases, ...dashboardClient } = client;
    const viewerAssignment = client.providerClients.find(
      ({ provider }) => provider.id === viewerProviderId
    );
    const canRequestCaseSupport =
      viewerRole !== "Supervisor" &&
      viewerRole !== "Caregiver" &&
      viewerAssignment?.organization?.type === "AGENCY" &&
      Boolean(viewerAssignment.organizationId) &&
      client.providerClients.some(
        (assignment) =>
          assignment.role === "Supervisor" &&
          assignment.organizationId === viewerAssignment.organizationId &&
          assignment.organization?.type === "AGENCY"
      );
    const activeTeamFocus = client.teamFocusItems.find(
      (teamFocus) =>
        teamFocus.isActive &&
        isTeamFocusVisible(teamFocus.displayStartedAt, now)
    );
    const formatTeamFocus = (teamFocus: DashboardPageTeamFocusRecord) => ({
      id: teamFocus.id,
      title: teamFocus.title
        ? clientDisplayText(teamFocus.title, client.firstName, client.lastName)
        : null,
      content: clientDisplayText(
        teamFocus.content,
        client.firstName,
        client.lastName
      ),
      displayStartedAt: teamFocus.displayStartedAt,
      createdAt: teamFocus.createdAt,
      updatedAt: teamFocus.updatedAt,
      author: teamFocus.author,
    });
    const currentTeamFocus = activeTeamFocus
      ? formatTeamFocus(activeTeamFocus)
      : null;
    // Revisions share one display period and retain the query's updated-at order.
    const earlierTeamFocusRevisions = activeTeamFocus
      ? client.teamFocusItems
          .filter(
            (teamFocus) =>
              teamFocus.id !== activeTeamFocus.id &&
              new Date(teamFocus.displayStartedAt).getTime() ===
                new Date(activeTeamFocus.displayStartedAt).getTime()
          )
          .map(formatTeamFocus)
      : [];

    return {
      ...dashboardClient,
      hasCaseSupportAccess: caseSupportCases.length > 0,
      canRequestCaseSupport,
      signal: clientSignals.get(client.id),
      recentEntries: recentEntriesByClientId.get(client.id) ?? [],
      teamFocusItems: currentTeamFocus
        ? [{ ...currentTeamFocus, revisions: earlierTeamFocusRevisions }]
        : [],
    };
  });
}
