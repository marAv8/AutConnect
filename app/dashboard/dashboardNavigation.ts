export type DashboardNavigationOwner = "provider" | "supervisor";
export type DashboardNavigationMode = "grid" | "orbit";

export type DashboardNavigationProvenance = {
  version: 1;
  owner: DashboardNavigationOwner;
  rootId: string;
  mode: DashboardNavigationMode;
  activeClientId?: string;
  hasGridPredecessor: boolean;
};

export type CareTeamDashboardOrigin = {
  version: 1;
  owner: "supervisor";
  rootId: string;
  clientId: string;
};

export const SUPERVISOR_DASHBOARD_HISTORY_KEY = "autConnectDashboardLayer";

export function dashboardNavigationId() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function gridNavigationProvenance(
  owner: DashboardNavigationOwner,
  rootId: string,
  activeClientId?: string
): DashboardNavigationProvenance {
  return {
    version: 1,
    owner,
    rootId,
    mode: "grid",
    activeClientId,
    hasGridPredecessor: false,
  };
}

export function orbitNavigationProvenance(
  grid: DashboardNavigationProvenance,
  activeClientId: string
): DashboardNavigationProvenance {
  return {
    version: 1,
    owner: grid.owner,
    rootId: grid.rootId,
    mode: "orbit",
    activeClientId,
    hasGridPredecessor: true,
  };
}

export function canReturnToDashboardGrid(
  provenance: DashboardNavigationProvenance | undefined,
  owner: DashboardNavigationOwner
) {
  return Boolean(
    provenance?.version === 1 &&
      provenance.owner === owner &&
      provenance.mode === "orbit" &&
      provenance.rootId &&
      provenance.hasGridPredecessor
  );
}

export function isDashboardNavigationProvenance(
  value: unknown,
  owner: DashboardNavigationOwner
): value is DashboardNavigationProvenance {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<DashboardNavigationProvenance>;
  return (
    candidate.version === 1 &&
    candidate.owner === owner &&
    typeof candidate.rootId === "string" &&
    (candidate.mode === "grid" || candidate.mode === "orbit")
  );
}

export function dashboardHistoryLayerMatchesLocation(
  layer: { mode?: unknown; activeClientId?: unknown } | undefined,
  currentHref: string,
  sameOrigin: string
) {
  if (layer?.mode !== "grid" && layer?.mode !== "orbit") return false;

  try {
    const url = new URL(currentHref, sameOrigin);
    if (url.origin !== sameOrigin || url.pathname !== "/dashboard") {
      return false;
    }

    if (layer.mode === "grid") {
      return url.search === "";
    }

    const keys = [...url.searchParams.keys()];
    return (
      typeof layer.activeClientId === "string" &&
      url.searchParams.get("clientId") === layer.activeClientId &&
      url.searchParams.get("view") === "orbit" &&
      keys.every((key) => key === "clientId" || key === "view")
    );
  } catch {
    return false;
  }
}

export function careTeamDashboardOrigin(
  provenance: DashboardNavigationProvenance | undefined,
  clientId: string
): CareTeamDashboardOrigin | undefined {
  if (
    !isDashboardNavigationProvenance(provenance, "supervisor") ||
    provenance.mode !== "orbit" ||
    provenance.activeClientId !== clientId ||
    !provenance.hasGridPredecessor
  ) {
    return undefined;
  }

  return {
    version: 1,
    owner: "supervisor",
    rootId: provenance.rootId,
    clientId,
  };
}

export function hasTrustedCareTeamDashboardOrigin(
  historyState: unknown,
  clientId: string
) {
  if (!historyState || typeof historyState !== "object") return false;
  const layer = (
    historyState as Record<string, unknown>
  )[SUPERVISOR_DASHBOARD_HISTORY_KEY];
  if (!layer || typeof layer !== "object") return false;

  const candidate = layer as {
    mode?: unknown;
    activeClientId?: unknown;
    navigation?: unknown;
    careTeamOrigin?: Partial<CareTeamDashboardOrigin>;
  };
  const navigation = candidate.navigation;
  const origin = candidate.careTeamOrigin;

  return (
    candidate.mode === "orbit" &&
    candidate.activeClientId === clientId &&
    isDashboardNavigationProvenance(navigation, "supervisor") &&
    navigation.mode === "orbit" &&
    navigation.activeClientId === clientId &&
    origin?.version === 1 &&
    origin.owner === "supervisor" &&
    origin.clientId === clientId &&
    origin.rootId === navigation.rootId
  );
}

export function careTeamDashboardUrl(clientId: string) {
  return `/dashboard?clientId=${encodeURIComponent(clientId)}&view=orbit`;
}

export function careTeamDestinationUrl(clientId: string) {
  return `/portal/supervisor/edit-providers/${encodeURIComponent(clientId)}`;
}

type CareTeamLinkActivation = {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  preventDefault: () => void;
};

export function runCareTeamLinkNavigation({
  event,
  clientId,
  closeMenu,
  navigate,
}: {
  event: CareTeamLinkActivation;
  clientId: string;
  closeMenu: () => void;
  navigate: (href: string) => void;
}) {
  const usesNativeLinkNavigation =
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey;

  if (usesNativeLinkNavigation) {
    closeMenu();
    return false;
  }

  event.preventDefault();
  closeMenu();
  navigate(careTeamDestinationUrl(clientId));
  return true;
}

export function directDashboardOrbitProvenance(
  owner: DashboardNavigationOwner,
  rootId: string,
  clientId: string
): DashboardNavigationProvenance {
  return {
    version: 1,
    owner,
    rootId,
    mode: "orbit",
    activeClientId: clientId,
    hasGridPredecessor: false,
  };
}
