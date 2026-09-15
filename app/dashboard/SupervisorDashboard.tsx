"use client";

/**
 * Supervisor-only workspace controller.
 * It coordinates client selection, orbit/grid modes, assignment management,
 * and the longitudinal Insights overlay without owning provider note forms.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { removeSupervisorClient } from "@/app/actions/manageSupervisorClients";
import DashboardWorkspaceLayout from "./DashboardWorkspaceLayout";
import GridClientView from "./GridClientView";
import OrbitView from "./OrbitView";
import FirstClientEmptyState from "./FirstClientEmptyState";
import InsightsOverlay from "./InsightsOverlay";
import SupervisorDashboardMenu from "./SupervisorDashboardMenu";
import {
  traceDashboardInteractionHandled,
  traceDashboardInteractionState,
} from "./dashboardInteractionTraceClient";
import type { DashboardClient } from "./dashboardClientTypes";
import {
  markDashboardProviderEntriesRead,
  projectDashboardEntrySaved,
} from "./clientCarouselModel";
import {
  dashboardClientInitials,
  dashboardClientPalette,
} from "./clientGridAppearance";
import DashboardProductGuide from "./DashboardProductGuide";
import { useDismissibleMenu } from "./useDismissibleMenu";
import {
  careTeamDashboardOrigin,
  canReturnToDashboardGrid,
  dashboardHistoryLayerMatchesLocation,
  dashboardNavigationId,
  directDashboardOrbitProvenance,
  gridNavigationProvenance,
  isDashboardNavigationProvenance,
  orbitNavigationProvenance,
  SUPERVISOR_DASHBOARD_HISTORY_KEY,
  type CareTeamDashboardOrigin,
  type DashboardNavigationProvenance,
} from "./dashboardNavigation";
import type { AdministrativePresentationCapabilities } from "./administrativeCapabilities";
import { applySuccessfulClientRemoval } from "./clientRemovalMode";

type Props = {
  assignedClients: DashboardClient[];
  currentProviderId: string;
  administrativeCapabilities: AdministrativePresentationCapabilities;
  newCaseSupportRequestCount: number;
  pendingOrganizationInvitationCount: number;
  initialClientId?: string;
  forceOrbitView?: boolean;
};

type Mode = "grid" | "orbit" | "remove";
type DashboardLayer = {
  mode: Mode;
  activeClientId?: string;
  insightsOpen?: boolean;
  navigation?: DashboardNavigationProvenance;
  careTeamOrigin?: CareTeamDashboardOrigin;
};
type PendingClientAction = {
  type: "remove";
  clientId: string;
  name: string;
};

const DASHBOARD_HISTORY_KEY = SUPERVISOR_DASHBOARD_HISTORY_KEY;

function dashboardLayerUrl(mode: Mode, activeClientId?: string) {
  return mode === "orbit" && activeClientId
    ? `/dashboard?clientId=${encodeURIComponent(activeClientId)}&view=orbit`
    : "/dashboard";
}

export default function SupervisorDashboard({
  assignedClients,
  currentProviderId,
  administrativeCapabilities,
  newCaseSupportRequestCount,
  pendingOrganizationInvitationCount,
  initialClientId,
  forceOrbitView = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashboardLocationKey = searchParams.toString();
  const canOpenOrbit =
    forceOrbitView &&
    !!initialClientId &&
    assignedClients.some((client) => client.id === initialClientId);

  const [assignedClientState, setAssignedClientState] =
    useState<DashboardClient[]>(assignedClients);
  const [mode, setMode] = useState<Mode>(canOpenOrbit ? "orbit" : "grid");

  useEffect(() => {
    if (mode === "grid" || mode === "orbit") {
      traceDashboardInteractionState(mode);
    }
  }, [mode]);
  const [activeClientId, setActiveClientId] = useState<string | undefined>(
    canOpenOrbit ? initialClientId : assignedClients[0]?.id
  );
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [focusedDataEntry, setFocusedDataEntry] = useState(false);
  const [pendingClientAction, setPendingClientAction] =
    useState<PendingClientAction | null>(null);
  const [clientActionError, setClientActionError] = useState("");
  const historyInitializedRef = useRef(false);
  const initialHistoryLayerRef = useRef({
    canOpenOrbit,
    initialClientId,
    firstAssignedClientId: assignedClients[0]?.id,
    assignedClientIds: new Set(assignedClients.map((client) => client.id)),
  });
  const {
    open: menuOpen,
    closeMenu: closeDashboardMenu,
    toggleMenu: toggleDashboardMenu,
    runMenuAction,
    triggerRef: menuTriggerRef,
    menuRef,
  } = useDismissibleMenu();

  useEffect(() => {
    setAssignedClientState(assignedClients);
  }, [assignedClients]);

  useEffect(() => {
    if (historyInitializedRef.current) return;
    historyInitializedRef.current = true;

    const initialHistory = initialHistoryLayerRef.current;
    const existingLayer = window.history.state?.[
      DASHBOARD_HISTORY_KEY
    ] as DashboardLayer | undefined;
    // A raw dashboard history layer can outlive Next's server search-param
    // snapshot after returning from another route. The address and our own
    // history metadata are authoritative for that restored entry.
    const existingMatchesUrl =
      existingLayer &&
      isDashboardNavigationProvenance(
        existingLayer.navigation,
        "supervisor"
      ) &&
      dashboardHistoryLayerMatchesLocation(
        existingLayer,
        window.location.href,
        window.location.origin
      ) &&
      (existingLayer.mode !== "orbit" ||
        initialHistory.assignedClientIds.has(
          String(existingLayer.activeClientId)
        ));

    if (existingMatchesUrl) {
      setMode(existingLayer.mode);
      setActiveClientId(existingLayer.activeClientId);
      setInsightsOpen(Boolean(existingLayer.insightsOpen));
    } else if (initialHistory.canOpenOrbit && initialHistory.initialClientId) {
      const directOrbitLayer: DashboardLayer = {
        mode: "orbit",
        activeClientId: initialHistory.initialClientId,
        insightsOpen: false,
        navigation: directDashboardOrbitProvenance(
          "supervisor",
          dashboardNavigationId(),
          initialHistory.initialClientId
        ),
      };
      window.history.replaceState(
        {
          ...window.history.state,
          [DASHBOARD_HISTORY_KEY]: directOrbitLayer,
        },
        "",
        dashboardLayerUrl(
          directOrbitLayer.mode,
          directOrbitLayer.activeClientId
        )
      );
    } else {
      const rootId = dashboardNavigationId();
      const gridNavigation = gridNavigationProvenance(
        "supervisor",
        rootId,
        initialHistory.firstAssignedClientId
      );
      const baseLayer: DashboardLayer = {
        mode: "grid",
        activeClientId: initialHistory.firstAssignedClientId,
        insightsOpen: false,
        navigation: gridNavigation,
      };

      window.history.replaceState(
        {
          ...window.history.state,
          [DASHBOARD_HISTORY_KEY]: baseLayer,
        },
        "",
        "/dashboard"
      );
    }

    const onPopState = (event: PopStateEvent) => {
      const layer = event.state?.[DASHBOARD_HISTORY_KEY] as
        | DashboardLayer
        | undefined;
      if (!layer?.mode) return;

      closeDashboardMenu();
      setMode(layer.mode);
      setActiveClientId(layer.activeClientId);
      setInsightsOpen(Boolean(layer.insightsOpen));
      setPendingClientAction(null);
      setClientActionError("");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [closeDashboardMenu]);

  useEffect(() => {
    if (!historyInitializedRef.current) return;
    const layer = window.history.state?.[
      DASHBOARD_HISTORY_KEY
    ] as DashboardLayer | undefined;
    if (
      !isDashboardNavigationProvenance(layer?.navigation, "supervisor") ||
      !dashboardHistoryLayerMatchesLocation(
        layer,
        window.location.href,
        window.location.origin
      ) ||
      (layer.mode === "orbit" &&
        !assignedClients.some((client) => client.id === layer.activeClientId))
    ) {
      return;
    }

    // Next can remount this controller after popstate has already fired. Its
    // native-history-aware search params are the second restoration signal.
    closeDashboardMenu();
    setMode(layer.mode);
    setActiveClientId(layer.activeClientId);
    setInsightsOpen(Boolean(layer.insightsOpen));
  }, [
    assignedClients,
    closeDashboardMenu,
    dashboardLocationKey,
  ]);

  const pushDashboardLayer = useCallback(
    (next: {
      mode: Mode;
      activeClientId?: string;
      insightsOpen?: boolean;
    }) => {
      const current = window.history.state?.[
        DASHBOARD_HISTORY_KEY
      ] as DashboardLayer | undefined;
      let navigation = current?.navigation;

      if (next.mode === "orbit" && next.activeClientId) {
        if (
          current?.mode === "grid" &&
          isDashboardNavigationProvenance(navigation, "supervisor")
        ) {
          navigation = orbitNavigationProvenance(
            navigation,
            next.activeClientId
          );
        } else if (
          isDashboardNavigationProvenance(navigation, "supervisor")
        ) {
          navigation = {
            ...navigation,
            mode: "orbit",
            activeClientId: next.activeClientId,
          };
        }
      }

      const nextLayer: DashboardLayer = {
        mode: next.mode,
        activeClientId: next.activeClientId,
        insightsOpen: Boolean(next.insightsOpen),
        navigation,
      };
      window.history.pushState(
        {
          ...window.history.state,
          [DASHBOARD_HISTORY_KEY]: nextLayer,
        },
        "",
        dashboardLayerUrl(next.mode, next.activeClientId)
      );
      closeDashboardMenu();
      setMode(next.mode);
      setActiveClientId(next.activeClientId);
      setInsightsOpen(Boolean(next.insightsOpen));
      setPendingClientAction(null);
      setClientActionError("");
    },
    [closeDashboardMenu]
  );

  const returnOneDashboardLayer = useCallback(() => {
    const layer = window.history.state?.[
      DASHBOARD_HISTORY_KEY
    ] as DashboardLayer | undefined;
    if (layer && (layer.mode !== "grid" || layer.insightsOpen)) {
      closeDashboardMenu();
      window.history.back();
      return;
    }

    const navigation = gridNavigationProvenance(
      "supervisor",
      layer?.navigation?.rootId ?? dashboardNavigationId(),
      activeClientId
    );
    const gridLayer: DashboardLayer = {
      mode: "grid" as Mode,
      activeClientId,
      insightsOpen: false,
      navigation,
    };
    window.history.replaceState(
      { ...window.history.state, [DASHBOARD_HISTORY_KEY]: gridLayer },
      "",
      "/dashboard"
    );
    closeDashboardMenu();
    setMode("grid");
    setInsightsOpen(false);
  }, [activeClientId, closeDashboardMenu]);

  const returnToClientGrid = useCallback(() => {
    const current = window.history.state?.[
      DASHBOARD_HISTORY_KEY
    ] as DashboardLayer | undefined;
    closeDashboardMenu();
    setMode("grid");
    setInsightsOpen(false);
    setPendingClientAction(null);
    setClientActionError("");

    if (canReturnToDashboardGrid(current?.navigation, "supervisor")) {
      window.history.back();
      return;
    }

    const navigation = gridNavigationProvenance(
      "supervisor",
      current?.navigation?.rootId ?? dashboardNavigationId(),
      activeClientId
    );
    const gridLayer: DashboardLayer = {
      mode: "grid",
      activeClientId,
      insightsOpen: false,
      navigation,
    };
    window.history.replaceState(
      { ...window.history.state, [DASHBOARD_HISTORY_KEY]: gridLayer },
      "",
      "/dashboard"
    );
  }, [activeClientId, closeDashboardMenu]);

  const onRemoveClient = async (clientId: string) => {
    setBusyClientId(clientId);
    setClientActionError("");
    try {
      const result = await removeSupervisorClient(clientId);
      if (!result.ok) {
        throw new Error("The client could not be removed.");
      }
      const removalResult = applySuccessfulClientRemoval(
        assignedClientState,
        activeClientId,
        clientId
      );
      setAssignedClientState(removalResult.remainingClients);
      setActiveClientId(removalResult.activeClientId);
    } catch (error) {
      setClientActionError(
        error instanceof Error ? error.message : "The client could not be removed."
      );
    } finally {
      setBusyClientId(null);
    }
  };

  const confirmPendingClientAction = async () => {
    const action = pendingClientAction;
    if (!action || busyClientId) return;

    await onRemoveClient(action.clientId);
    setPendingClientAction(null);
  };

  useEffect(() => {
    if (mode !== "remove" || pendingClientAction) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      returnOneDashboardLayer();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mode, pendingClientAction, returnOneDashboardLayer]);

  const handleActiveClientChange = useCallback(
    (clientId: string) => {
      if (clientId !== activeClientId) {
        setInsightsOpen(false);
        setActiveClientId(clientId);
        const layer = window.history.state?.[
          DASHBOARD_HISTORY_KEY
        ] as DashboardLayer | undefined;
        if (layer?.mode === "orbit") {
          window.history.replaceState(
            {
              ...window.history.state,
              [DASHBOARD_HISTORY_KEY]: {
                ...layer,
                activeClientId: clientId,
                insightsOpen: false,
                navigation: layer.navigation
                  ? {
                      ...layer.navigation,
                      activeClientId: clientId,
                    }
                  : undefined,
              },
            },
            "",
            dashboardLayerUrl("orbit", clientId)
          );
        }
      }
    },
    [activeClientId]
  );

  const prepareCareTeamNavigation = useCallback((clientId: string) => {
    const layer = window.history.state?.[
      DASHBOARD_HISTORY_KEY
    ] as DashboardLayer | undefined;
    const origin = careTeamDashboardOrigin(layer?.navigation, clientId);
    if (layer?.mode === "orbit" && origin) {
      window.history.replaceState(
        {
          ...window.history.state,
          [DASHBOARD_HISTORY_KEY]: { ...layer, careTeamOrigin: origin },
        },
        ""
      );
    }

    router.push(
      `/portal/supervisor/edit-providers/${encodeURIComponent(clientId)}`
    );
  }, [router]);

  const handleEntryRead = useCallback(
    (clientId: string, authorProviderId: string) => {
      setAssignedClientState((currentClients) =>
        markDashboardProviderEntriesRead(currentClients, clientId, authorProviderId)
      );
    },
    []
  );

  const handleClientSignalRead = useCallback((clientId: string) => {
    setAssignedClientState((currentClients) =>
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
      setAssignedClientState((currentClients) =>
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

  const topNav =
    mode === "orbit" ? (
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
          cursor: "pointer",
        }}
      >
        Client List
      </button>
    ) : null;

  const activeClient = assignedClientState.find((client) => client.id === activeClientId);
  const currentAssignedClientIds = new Set(
    assignedClientState.map(({ id }) => id)
  );
  const visibleAdministrativeCapabilities = {
    ...administrativeCapabilities,
    removableClientIds: administrativeCapabilities.removableClientIds.filter(
      (clientId) => currentAssignedClientIds.has(clientId)
    ),
    careTeamClientIds: administrativeCapabilities.careTeamClientIds.filter(
      (clientId) => currentAssignedClientIds.has(clientId)
    ),
  };
  const content =
    assignedClientState.length === 0 && mode === "grid" ? (
      <FirstClientEmptyState
        canAddClient={visibleAdministrativeCapabilities.canAddClient}
        canAttachExistingClient={
          visibleAdministrativeCapabilities.canAttachExistingClient
        }
      />
    ) : mode === "orbit" ? (
      <div style={{ position: "relative", width: "100%" }}>
        <OrbitView
          clients={assignedClientState}
          currentProviderId={currentProviderId}
          viewerRole="Supervisor"
          activeClientId={activeClientId}
          onActiveClientChange={handleActiveClientChange}
          onEntryRead={handleEntryRead}
          onClientSignalRead={handleClientSignalRead}
          onEntrySaved={handleEntrySaved}
          onFocusedDataEntryChange={setFocusedDataEntry}
          onTeamFocusSaved={(clientId, teamFocus) => {
            setAssignedClientState((currentClients) =>
              currentClients.map((client) =>
                client.id === clientId
                  ? (() => {
                      const previousFocus = client.teamFocusItems?.[0];
                      const belongsToSameFocusPeriod =
                        previousFocus &&
                        new Date(previousFocus.displayStartedAt).getTime() ===
                          new Date(teamFocus.displayStartedAt).getTime();
                      const previousRevision = belongsToSameFocusPeriod
                        ? {
                            id: previousFocus.id,
                            title: previousFocus.title,
                            content: previousFocus.content,
                            displayStartedAt: previousFocus.displayStartedAt,
                            createdAt: previousFocus.createdAt,
                            updatedAt: previousFocus.updatedAt,
                            author: previousFocus.author,
                          }
                        : null;

                      return {
                        ...client,
                        teamFocusItems: [
                          {
                            ...teamFocus,
                            revisions: previousRevision
                              ? [
                                  previousRevision,
                                  ...(previousFocus?.revisions ?? []),
                                ]
                              : [],
                          },
                        ],
                      };
                    })()
                  : client
              )
            );
          }}
        />
        {activeClient && insightsOpen ? (
          <InsightsOverlay
            key={activeClient.id}
            clientId={activeClient.id}
            isOpen={insightsOpen}
            onClose={returnOneDashboardLayer}
          />
        ) : null}
      </div>
    ) : mode === "grid" || mode === "remove" ? (
      <GridClientView
        clients={assignedClientState}
        palette={dashboardClientPalette}
        initialsOf={dashboardClientInitials}
        removalMode={mode === "remove"}
        removableClientIds={visibleAdministrativeCapabilities.removableClientIds}
        busyClientId={busyClientId}
        onClientClick={(clientId) => {
          pushDashboardLayer({
            mode: "orbit",
            activeClientId: clientId,
          });
        }}
        onRemoveClient={(clientId, name) => {
          setPendingClientAction({ type: "remove", clientId, name });
        }}
      />
    ) : null;

  const floatingMenu = (
    <SupervisorDashboardMenu
      mode={mode}
      menuOpen={menuOpen}
      administrativeCapabilities={visibleAdministrativeCapabilities}
      newCaseSupportRequestCount={newCaseSupportRequestCount}
      pendingOrganizationInvitationCount={pendingOrganizationInvitationCount}
      activeClientId={activeClientId}
      activeTeamFocus={
        mode === "orbit" ? activeClient?.teamFocusItems?.[0] : undefined
      }
      currentProviderId={currentProviderId}
      menuRef={menuRef}
      triggerRef={menuTriggerRef}
      onToggle={toggleDashboardMenu}
      onClose={closeDashboardMenu}
      onOpenCareTeam={prepareCareTeamNavigation}
      onOpenRemoveClient={() => {
        runMenuAction(() => {
          pushDashboardLayer({
            mode: "remove",
            activeClientId,
          });
        });
      }}
      onOpenInsights={() => {
        runMenuAction(() => {
          pushDashboardLayer({
            mode: "orbit",
            activeClientId,
            insightsOpen: true,
          });
        });
      }}
      onOpenGuide={() => {
        runMenuAction(() => {
          setGuideOpen(true);
        });
      }}
    />
  );

  return (
    <>
      <DashboardWorkspaceLayout
        topNav={topNav}
        content={content}
        utilitiesHidden={focusedDataEntry}
        floatingMenu={floatingMenu}
        onContentPointerDown={(event) => {
          if (
            mode !== "remove" ||
            pendingClientAction ||
            !(event.target instanceof Element) ||
            event.target.closest('[data-client-grid-mode="remove"]')
          ) {
            return;
          }

          returnOneDashboardLayer();
        }}
      />
      {pendingClientAction ? (
        <ClientActionConfirmation
          action={pendingClientAction}
          busy={busyClientId === pendingClientAction.clientId}
          onCancel={() => setPendingClientAction(null)}
          onConfirm={() => void confirmPendingClientAction()}
        />
      ) : null}
      {guideOpen ? <DashboardProductGuide onClose={() => setGuideOpen(false)} /> : null}
      {clientActionError ? (
        <div
          role="alert"
          className="paper-surface"
          style={{
            position: "fixed",
            left: "50%",
            bottom: "calc(24px + env(safe-area-inset-bottom))",
            zIndex: 140,
            transform: "translateX(-50%)",
            width: "min(calc(100vw - 32px), 420px)",
            padding: "14px 18px",
            textAlign: "center",
          }}
        >
          {clientActionError}
        </div>
      ) : null}
    </>
  );
}

function ClientActionConfirmation({
  action,
  busy,
  onCancel,
  onConfirm,
}: {
  action: PendingClientAction;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 130,
        display: "grid",
        placeItems: "center",
        padding: 20,
        background: "rgb(0 0 0 / 22%)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
      }}
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="client-action-title"
        className="paper-surface"
        style={{
          width: "min(100%, 420px)",
          padding: "24px clamp(20px, 6vw, 30px)",
          display: "grid",
          justifyItems: "center",
          gap: 18,
          textAlign: "center",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div id="client-action-title" style={{ fontSize: 20, fontWeight: 650 }}>
          Remove Client
        </div>
        <div style={{ lineHeight: 1.5, opacity: 0.72 }}>
          {`Remove ${action.name} from your dashboard? The client record will remain available to other assigned providers.`}
        </div>
        <div style={{ display: "flex", justifyContent: "center", gap: 12 }}>
          <button
            type="button"
            className="action-secondary"
            onClick={onCancel}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="action-negative"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : "Remove"}
          </button>
        </div>
      </div>
    </div>
  );
}
