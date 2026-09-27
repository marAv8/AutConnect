"use client";

import { preserveFirstActivationFlag } from "./firstActivationFlag";
import {
  createDashboardArrivalCoordinator,
  preserveClientListEntrancePreview,
} from "./clientListEntrance";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import DashboardWorkspaceLayout from "./DashboardWorkspaceLayout";
import FirstClientEmptyState from "./FirstClientEmptyState";
import GridClientView from "./GridClientView";
import OrbitView from "./OrbitView";
import {
  markDashboardProviderEntriesRead,
  projectDashboardEntrySaved,
} from "./clientCarouselModel";
import {
  dashboardClientInitials,
  dashboardClientPalette,
} from "./clientGridAppearance";
import type { DashboardClient } from "./dashboardClientTypes";
import CaseSupportProviderNotice from "./CaseSupportProviderNotice";
import DashboardProductGuide from "./DashboardProductGuide";
import { Info } from "lucide-react";
import ThemeToggle from "@/app/components/ThemeToggle";
import TeamFocusSignalControl from "./TeamFocusSignalControl";
import DashboardInboxControl from "./DashboardInboxControl";
import ProviderDashboardMoreMenu from "./ProviderDashboardMoreMenu";
import DashboardArrivalUtilities from "./DashboardArrivalUtilities";
import {
  traceDashboardInteractionHandled,
  traceDashboardInteractionState,
} from "./dashboardInteractionTraceClient";
import {
  canReturnToDashboardGrid,
  dashboardHistoryLayerMatchesLocation,
  dashboardNavigationId,
  directDashboardOrbitProvenance,
  gridNavigationProvenance,
  isDashboardNavigationProvenance,
  orbitNavigationProvenance,
  type DashboardNavigationProvenance,
} from "./dashboardNavigation";

import type { DashboardAttentionCounts } from "./dashboardAttentionTypes";

type Props = {
  clients: DashboardClient[];
  currentProviderId: string;
  viewerRole: string;
  initialClientId?: string;
  forceOrbitView?: boolean;
  clientListLabel: string;
  canReviewOrganizationInvitations: boolean;
  canAttachExistingClient: boolean;
  pendingOrganizationInvitationCount: number;
  attentionCounts?: DashboardAttentionCounts;
  caseSupportUpdates?: Array<{
    id: string;
    status: string;
    updatedAt: Date | string;
    responseNote: string | null;
    client: { firstName: string; lastName: string };
    recipientSupervisor: { firstName: string; lastName: string };
  }>;
};

type Mode = "grid" | "orbit";
type ProviderDashboardLayer = {
  mode: Mode;
  activeClientId?: string;
  navigation?: DashboardNavigationProvenance;
};

const PROVIDER_DASHBOARD_HISTORY_KEY = "autConnectProviderDashboardLayer";

function providerDashboardUrl(mode: Mode, activeClientId?: string) {
  return preserveClientListEntrancePreview(preserveFirstActivationFlag(mode === "orbit" && activeClientId
    ? `/dashboard?clientId=${encodeURIComponent(activeClientId)}&view=orbit`
    : "/dashboard"));
}

export default function ProviderDashboard({
  clients,
  currentProviderId,
  viewerRole,
  initialClientId,
  forceOrbitView = false,
  clientListLabel,
  canReviewOrganizationInvitations,
  canAttachExistingClient,
  pendingOrganizationInvitationCount,
  attentionCounts,
  caseSupportUpdates = [],
}: Props) {
  const searchParams = useSearchParams();
  const dashboardLocationKey = searchParams.toString();
  const singleCaretakerClientId =
    viewerRole === "Caregiver" && clients.length === 1 ? clients[0]?.id : undefined;
  const requestedOrbitClientId =
    forceOrbitView &&
    !!initialClientId &&
    clients.some((client) => client.id === initialClientId)
      ? initialClientId
      : singleCaretakerClientId;
  const canOpenOrbit = !!requestedOrbitClientId;
  const [clientState, setClientState] = useState(clients);
  const arrivalCoordinator = useMemo(
    () => createDashboardArrivalCoordinator(currentProviderId),
    [currentProviderId]
  );
  const [mode, setMode] = useState<Mode>(canOpenOrbit ? "orbit" : "grid");

  useEffect(() => {
    traceDashboardInteractionState(mode === "orbit" ? "orbit" : "grid");
  }, [mode]);
  const [activeClientId, setActiveClientId] = useState<string | undefined>(
    canOpenOrbit ? requestedOrbitClientId : clients[0]?.id
  );
  const [guideOpen, setGuideOpen] = useState(false);
  const [focusedDataEntry, setFocusedDataEntry] = useState(false);
  const historyInitializedRef = useRef(false);
  const initialHistoryLayerRef = useRef({
    canOpenOrbit,
    initialClientId: requestedOrbitClientId,
    firstClientId: clients[0]?.id,
    clientIds: new Set(clients.map((client) => client.id)),
  });

  useEffect(() => {
    setClientState(clients);
  }, [clients]);

  useEffect(() => {
    if (historyInitializedRef.current) return;
    historyInitializedRef.current = true;

    const existingLayer = window.history.state?.[
      PROVIDER_DASHBOARD_HISTORY_KEY
    ] as ProviderDashboardLayer | undefined;
    const initial = initialHistoryLayerRef.current;

    // A raw dashboard history layer can outlive Next's server search-param
    // snapshot after returning from another route. The address and our own
    // history metadata are authoritative for that restored entry.
    const existingMatchesUrl =
      existingLayer &&
      isDashboardNavigationProvenance(existingLayer.navigation, "provider") &&
      dashboardHistoryLayerMatchesLocation(
        existingLayer,
        window.location.href,
        window.location.origin
      ) &&
      (existingLayer.mode !== "orbit" ||
        initial.clientIds.has(String(existingLayer.activeClientId)));

    if (existingMatchesUrl) {
      setMode(existingLayer.mode);
      setActiveClientId(existingLayer.activeClientId);
    } else if (initial.canOpenOrbit && initial.initialClientId) {
      const directOrbitLayer: ProviderDashboardLayer = {
        mode: "orbit",
        activeClientId: initial.initialClientId,
        navigation: directDashboardOrbitProvenance(
          "provider",
          dashboardNavigationId(),
          initial.initialClientId
        ),
      };
      window.history.replaceState(
        {
          ...window.history.state,
          [PROVIDER_DASHBOARD_HISTORY_KEY]: directOrbitLayer,
        },
        "",
        providerDashboardUrl(
          directOrbitLayer.mode,
          directOrbitLayer.activeClientId
        )
      );
    } else {
      const rootId = dashboardNavigationId();
      const gridNavigation = gridNavigationProvenance(
        "provider",
        rootId,
        initial.firstClientId
      );
      const gridLayer: ProviderDashboardLayer = {
        mode: "grid",
        activeClientId: initial.firstClientId,
        navigation: gridNavigation,
      };
      window.history.replaceState(
        { ...window.history.state, [PROVIDER_DASHBOARD_HISTORY_KEY]: gridLayer },
        "",
        providerDashboardUrl(gridLayer.mode, gridLayer.activeClientId)
      );
    }

  }, []);

  // History initialization survives effect reactivation; subscriptions do not.
  // Each activation owns one listener and cleanup removes that exact closure.
  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      const layer = event.state?.[
        PROVIDER_DASHBOARD_HISTORY_KEY
      ] as ProviderDashboardLayer | undefined;
      if (!layer?.mode) return;
      setMode(layer.mode);
      setActiveClientId(layer.activeClientId);
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    if (!historyInitializedRef.current) return;
    const layer = window.history.state?.[
      PROVIDER_DASHBOARD_HISTORY_KEY
    ] as ProviderDashboardLayer | undefined;
    if (
      !isDashboardNavigationProvenance(layer?.navigation, "provider") ||
      !dashboardHistoryLayerMatchesLocation(
        layer,
        window.location.href,
        window.location.origin
      ) ||
      (layer.mode === "orbit" &&
        !clients.some((client) => client.id === layer.activeClientId))
    ) {
      return;
    }

    // Next can remount this controller after popstate has already fired. Its
    // native-history-aware search params are the second restoration signal.
    setMode(layer.mode);
    setActiveClientId(layer.activeClientId);
  }, [clients, dashboardLocationKey]);

  const openClientOrbit = useCallback((clientId: string) => {
    traceDashboardInteractionHandled("grid-client");
    const current = window.history.state?.[
      PROVIDER_DASHBOARD_HISTORY_KEY
    ] as ProviderDashboardLayer | undefined;
    const gridNavigation = isDashboardNavigationProvenance(
      current?.navigation,
      "provider"
    )
      ? current.navigation
      : gridNavigationProvenance(
          "provider",
          dashboardNavigationId(),
          current?.activeClientId
        );
    const layer: ProviderDashboardLayer = {
      mode: "orbit",
      activeClientId: clientId,
      navigation: orbitNavigationProvenance(gridNavigation, clientId),
    };
    window.history.pushState(
      { ...window.history.state, [PROVIDER_DASHBOARD_HISTORY_KEY]: layer },
      "",
      providerDashboardUrl(layer.mode, layer.activeClientId)
    );
    setActiveClientId(clientId);
    setMode("orbit");
  }, []);

  const returnToClientGrid = useCallback(() => {
    const current = window.history.state?.[
      PROVIDER_DASHBOARD_HISTORY_KEY
    ] as ProviderDashboardLayer | undefined;
    setMode("grid");

    if (canReturnToDashboardGrid(current?.navigation, "provider")) {
      window.history.back();
      return;
    }

    const gridLayer: ProviderDashboardLayer = {
      mode: "grid",
      activeClientId,
      navigation: gridNavigationProvenance(
        "provider",
        current?.navigation?.rootId ?? dashboardNavigationId(),
        activeClientId
      ),
    };
    window.history.replaceState(
      { ...window.history.state, [PROVIDER_DASHBOARD_HISTORY_KEY]: gridLayer },
      "",
      preserveClientListEntrancePreview(preserveFirstActivationFlag("/dashboard"))
    );
  }, [activeClientId]);

  const handleActiveClientChange = useCallback((clientId: string) => {
    setActiveClientId(clientId);
    const layer = window.history.state?.[
      PROVIDER_DASHBOARD_HISTORY_KEY
    ] as ProviderDashboardLayer | undefined;
    if (layer?.mode !== "orbit") return;
    const nextLayer: ProviderDashboardLayer = {
      ...layer,
      activeClientId: clientId,
      navigation: layer.navigation
        ? { ...layer.navigation, activeClientId: clientId }
        : undefined,
    };
    window.history.replaceState(
      { ...window.history.state, [PROVIDER_DASHBOARD_HISTORY_KEY]: nextLayer },
      "",
      providerDashboardUrl(nextLayer.mode, nextLayer.activeClientId)
    );
  }, []);

  const handleEntryRead = useCallback(
    (clientId: string, authorProviderId: string, entryIds: string[]) => {
      setClientState((currentClients) =>
        markDashboardProviderEntriesRead(
          currentClients,
          clientId,
          authorProviderId,
          entryIds
        )
      );
    },
    []
  );

  const handleClientSignalRead = useCallback((clientId: string) => {
    setClientState((currentClients) =>
      currentClients.map((client) =>
        client.id === clientId && client.signal
          ? { ...client, signal: { ...client.signal, isUnread: false } }
          : client
      )
    );
  }, []);

  const handleEntrySaved = useCallback(
    (
      clientId: string,
      authorProviderId: string,
      entryId: string,
      visibility?: "Private" | "Shared",
      status?: string
    ) => {
      setClientState((currentClients) =>
        projectDashboardEntrySaved(
          currentClients,
          clientId,
          authorProviderId,
          entryId,
          undefined,
          visibility,
          status,
          currentProviderId
        )
      );
    },
    [currentProviderId]
  );

  const topNav = (
    <button
      type="button"
      className="back-link dashboard-client-list-control"
      data-dashboard-trace-control="client-list"
      onClick={() => {
        traceDashboardInteractionHandled("client-list");
        returnToClientGrid();
      }}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        margin: 0,
        fontSize: 15,
        fontWeight: 550,
        cursor: mode === "grid" ? "default" : "pointer",
        visibility: mode === "grid" ? "hidden" : "visible",
        pointerEvents: mode === "grid" ? "none" : "auto",
      }}
    >
      {clientListLabel}
    </button>
  );

  const content =
    clientState.length === 0 ? (
      <FirstClientEmptyState />
    ) : mode === "orbit" ? (
      <OrbitView
        clients={clientState}
        currentProviderId={currentProviderId}
        viewerRole={viewerRole}
        activeClientId={activeClientId}
        onActiveClientChange={handleActiveClientChange}
        onEntryRead={handleEntryRead}
        onClientSignalRead={handleClientSignalRead}
        onEntrySaved={handleEntrySaved}
        onFocusedDataEntryChange={setFocusedDataEntry}
        arrivalCoordinator={arrivalCoordinator}
      />
    ) : (
      <GridClientView
        clients={clientState}
        palette={dashboardClientPalette}
        initialsOf={dashboardClientInitials}
        arrivalCoordinator={arrivalCoordinator}
        onClientClick={openClientOrbit}
      />
    );

  const activeClient = clientState.find((client) => client.id === activeClientId);
  const activeTeamFocus =
    mode === "orbit" ? activeClient?.teamFocusItems?.[0] : undefined;

  return (
    <>
      <DashboardWorkspaceLayout
        topNav={mode === "grid" ? null : topNav}
        notice={
          caseSupportUpdates.length > 0 ? (
            <CaseSupportProviderNotice updates={caseSupportUpdates} />
          ) : null
        }
        content={content}
        utilitiesHidden={focusedDataEntry}
        floatingMenu={
          <DashboardArrivalUtilities arrivalCoordinator={arrivalCoordinator}>
            <div className="dashboard-utility-controls">
            {canAttachExistingClient ? (
              <ProviderDashboardMoreMenu
                canAttachExistingClient
                onOpenGuide={() => setGuideOpen(true)}
              />
            ) : (
              <button
                type="button"
                className="material-control dashboard-round-icon-control dashboard-round-icon-control--arrival dashboard-info-control"
                aria-label="How AutConnect works"
                onClick={() => { traceDashboardInteractionHandled("guide"); setGuideOpen(true); }}
              >
                <span className="dashboard-utility-arrival-visual">
                  <Info aria-hidden="true" size={22} strokeWidth={1.8} />
                </span>
              </button>
            )}
            <DashboardInboxControl
              attentionCounts={attentionCounts}
              canAccessCaseSupport={false}
              canReviewOrganizationInvitations={
                canReviewOrganizationInvitations
              }
              caseSupportCount={0}
              organizationInvitationCount={
                pendingOrganizationInvitationCount
              }
            />
            {mode === "orbit" ? (
              <TeamFocusSignalControl
                clientId={activeClientId}
                teamFocus={activeTeamFocus}
                viewerProviderId={currentProviderId}
              />
            ) : null}
            <ThemeToggle />
            </div>
          </DashboardArrivalUtilities>
        }
      />
      {guideOpen ? <DashboardProductGuide onClose={() => setGuideOpen(false)} /> : null}
    </>
  );
}
