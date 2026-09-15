import {
  SUPERVISOR_DASHBOARD_HISTORY_KEY,
  isDashboardNavigationProvenance,
} from "./dashboardNavigation";

const DASHBOARD_ORBIT_PRESENTATION_KEY =
  "autConnectDashboardOrbitPresentation";

export type DashboardOrbitReturnMarker = {
  version: 1;
  owner: "supervisor";
  rootId: string;
  clientId: string;
  presentationKey: string;
};

type DashboardLayer = {
  mode?: unknown;
  activeClientId?: unknown;
  navigation?: unknown;
};

export function dashboardOrbitPresentationKey(
  client: {
    id: string;
    providerClients: Array<{ provider: { id: string } }>;
  },
  currentProviderId: string
) {
  return [
    client.id,
    currentProviderId,
    ...client.providerClients.map(({ provider }) => provider.id),
  ].join("|");
}

export function attachDashboardOrbitReturnMarker({
  historyState,
  clientId,
  rootId,
  presentationKey,
}: {
  historyState: unknown;
  clientId: string;
  rootId: string;
  presentationKey: string;
}) {
  if (!historyState || typeof historyState !== "object") return historyState;
  const layer = (historyState as Record<string, unknown>)[
    SUPERVISOR_DASHBOARD_HISTORY_KEY
  ] as DashboardLayer | undefined;
  if (
    layer?.mode !== "orbit" ||
    layer.activeClientId !== clientId ||
    !isDashboardNavigationProvenance(layer.navigation, "supervisor") ||
    layer.navigation.mode !== "orbit" ||
    layer.navigation.activeClientId !== clientId ||
    layer.navigation.rootId !== rootId
  ) {
    return historyState;
  }

  return {
    ...(historyState as Record<string, unknown>),
    [DASHBOARD_ORBIT_PRESENTATION_KEY]: {
      version: 1,
      owner: "supervisor",
      rootId,
      clientId,
      presentationKey,
    } satisfies DashboardOrbitReturnMarker,
  };
}

export function readDashboardOrbitReturnMarker({
  historyState,
  clientId,
  presentationKey,
}: {
  historyState: unknown;
  clientId: string;
  presentationKey: string;
}) {
  if (!historyState || typeof historyState !== "object") return null;
  const state = historyState as Record<string, unknown>;
  const layer = state[SUPERVISOR_DASHBOARD_HISTORY_KEY] as
    | DashboardLayer
    | undefined;
  const snapshot = state[DASHBOARD_ORBIT_PRESENTATION_KEY] as
    | Partial<DashboardOrbitReturnMarker>
    | undefined;

  if (
    layer?.mode !== "orbit" ||
    layer.activeClientId !== clientId ||
    !isDashboardNavigationProvenance(layer.navigation, "supervisor") ||
    layer.navigation.mode !== "orbit" ||
    layer.navigation.activeClientId !== clientId ||
    snapshot?.version !== 1 ||
    snapshot.owner !== "supervisor" ||
    snapshot.clientId !== clientId ||
    snapshot.rootId !== layer.navigation.rootId ||
    snapshot.presentationKey !== presentationKey
  ) {
    return null;
  }

  return snapshot as DashboardOrbitReturnMarker;
}
