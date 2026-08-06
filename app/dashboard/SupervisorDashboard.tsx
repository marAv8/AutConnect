"use client";

/**
 * Supervisor-only workspace controller.
 * It coordinates client selection, orbit/grid modes, assignment management,
 * and the longitudinal Insights overlay without owning provider note forms.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addSupervisorClient,
  removeSupervisorClient,
} from "@/app/actions/manageSupervisorClients";
import DashboardWorkspaceLayout from "./DashboardWorkspaceLayout";
import GridClientView from "./GridClientView";
import OrbitView from "./OrbitView";
import AddClientView from "./AddClientView";
import RemoveClientView from "./RemoveClientView";
import FirstClientEmptyState from "./FirstClientEmptyState";
import InsightsOverlay from "./InsightsOverlay";
import SupervisorDashboardMenu from "./SupervisorDashboardMenu";
import CaseSupportRequestNotice from "./CaseSupportRequestNotice";
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

type AvailableClient = {
  id: string;
  firstName: string;
  lastName: string;
};

type Props = {
  assignedClients: DashboardClient[];
  availableClients: AvailableClient[];
  currentProviderId: string;
  caseSupportRequests?: Array<{
    id: string;
    status: string;
    createdAt: Date | string;
    client: {
      firstName: string;
      lastName: string;
    };
    requester: {
      firstName: string;
      lastName: string;
      role: string;
    };
  }>;
  initialClientId?: string;
  forceOrbitView?: boolean;
};

type Mode = "grid" | "orbit" | "remove" | "add";
type PendingClientAction = {
  type: "add" | "remove";
  clientId: string;
  name: string;
};

const DASHBOARD_HISTORY_KEY = "autConnectDashboardLayer";

export default function SupervisorDashboard({
  assignedClients,
  availableClients,
  currentProviderId,
  caseSupportRequests = [],
  initialClientId,
  forceOrbitView = false,
}: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const canOpenOrbit =
    forceOrbitView &&
    !!initialClientId &&
    assignedClients.some((client) => client.id === initialClientId);

  const [assignedClientState, setAssignedClientState] =
    useState<DashboardClient[]>(assignedClients);
  const [availableClientState, setAvailableClientState] =
    useState<AvailableClient[]>(availableClients);
  const [mode, setMode] = useState<Mode>(canOpenOrbit ? "orbit" : "grid");
  const [activeClientId, setActiveClientId] = useState<string | undefined>(
    canOpenOrbit ? initialClientId : assignedClients[0]?.id
  );
  const [menuOpen, setMenuOpen] = useState(false);
  const [busyClientId, setBusyClientId] = useState<string | null>(null);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [recentlyAddedClientId, setRecentlyAddedClientId] = useState<string | null>(null);
  const [pendingClientAction, setPendingClientAction] =
    useState<PendingClientAction | null>(null);
  const [clientActionError, setClientActionError] = useState("");
  const historyInitializedRef = useRef(false);
  const initialHistoryLayerRef = useRef({
    canOpenOrbit,
    initialClientId,
    firstAssignedClientId: assignedClients[0]?.id,
  });
  const closeDashboardMenu = useCallback(() => {
    const layer = window.history.state?.[DASHBOARD_HISTORY_KEY] as
      | { menuOpen?: boolean }
      | undefined;
    if (layer?.menuOpen) {
      window.history.back();
      return;
    }
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    setAssignedClientState(assignedClients);
  }, [assignedClients]);

  useEffect(() => {
    setAvailableClientState(availableClients);
  }, [availableClients]);

  useEffect(() => {
    if (!menuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        closeDashboardMenu();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDashboardMenu();
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDashboardMenu, menuOpen]);

  useEffect(() => {
    if (!recentlyAddedClientId) return;

    const timeout = window.setTimeout(() => {
      setRecentlyAddedClientId(null);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [recentlyAddedClientId]);

  useEffect(() => {
    if (historyInitializedRef.current) return;
    historyInitializedRef.current = true;

    const initialHistory = initialHistoryLayerRef.current;
    const baseLayer = {
      mode: "grid" as Mode,
      activeClientId: initialHistory.firstAssignedClientId,
      insightsOpen: false,
      menuOpen: false,
    };
    const initialLayer = {
      mode: initialHistory.canOpenOrbit ? ("orbit" as Mode) : ("grid" as Mode),
      activeClientId: initialHistory.canOpenOrbit
        ? initialHistory.initialClientId
        : initialHistory.firstAssignedClientId,
      insightsOpen: false,
      menuOpen: false,
    };

    window.history.replaceState(
      {
        ...window.history.state,
        [DASHBOARD_HISTORY_KEY]: baseLayer,
      },
      ""
    );

    if (initialHistory.canOpenOrbit) {
      window.history.pushState(
        {
          ...window.history.state,
          [DASHBOARD_HISTORY_KEY]: initialLayer,
        },
        ""
      );
    }

    const onPopState = (event: PopStateEvent) => {
      const layer = event.state?.[DASHBOARD_HISTORY_KEY] as
        | {
            mode?: Mode;
            activeClientId?: string;
            insightsOpen?: boolean;
            menuOpen?: boolean;
          }
        | undefined;
      if (!layer?.mode) return;

      setMode(layer.mode);
      setActiveClientId(layer.activeClientId);
      setInsightsOpen(Boolean(layer.insightsOpen));
      setMenuOpen(Boolean(layer.menuOpen));
      setPendingClientAction(null);
      setClientActionError("");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const pushDashboardLayer = useCallback(
    (next: {
      mode: Mode;
      activeClientId?: string;
      insightsOpen?: boolean;
      menuOpen?: boolean;
    }) => {
      window.history.pushState(
        {
          ...window.history.state,
          [DASHBOARD_HISTORY_KEY]: {
            mode: next.mode,
            activeClientId: next.activeClientId,
            insightsOpen: Boolean(next.insightsOpen),
            menuOpen: Boolean(next.menuOpen),
          },
        },
        ""
      );
      setMode(next.mode);
      setActiveClientId(next.activeClientId);
      setInsightsOpen(Boolean(next.insightsOpen));
      setMenuOpen(Boolean(next.menuOpen));
      setPendingClientAction(null);
      setClientActionError("");
    },
    []
  );

  const replaceDashboardLayer = useCallback(
    (next: {
      mode: Mode;
      activeClientId?: string;
      insightsOpen?: boolean;
      menuOpen?: boolean;
    }) => {
      window.history.replaceState(
        {
          ...window.history.state,
          [DASHBOARD_HISTORY_KEY]: {
            mode: next.mode,
            activeClientId: next.activeClientId,
            insightsOpen: Boolean(next.insightsOpen),
            menuOpen: Boolean(next.menuOpen),
          },
        },
        ""
      );
      setMode(next.mode);
      setActiveClientId(next.activeClientId);
      setInsightsOpen(Boolean(next.insightsOpen));
      setMenuOpen(Boolean(next.menuOpen));
      setPendingClientAction(null);
      setClientActionError("");
    },
    []
  );

  const returnOneDashboardLayer = useCallback(() => {
    const layer = window.history.state?.[DASHBOARD_HISTORY_KEY] as
      | { mode?: Mode; insightsOpen?: boolean }
      | undefined;
    if (layer && (layer.mode !== "grid" || layer.insightsOpen)) {
      window.history.back();
      return;
    }

    setMode("grid");
    setInsightsOpen(false);
    setMenuOpen(false);
  }, []);

  const visibleAddClients = useMemo(
    () =>
      assignedClientState
        .map((client) => ({
          id: client.id,
          firstName: client.firstName,
          lastName: client.lastName,
          attached: true,
        }))
        .concat(
          availableClientState.map((client) => ({
            ...client,
            attached: false,
          }))
        ),
    [assignedClientState, availableClientState]
  );

  const onRemoveClient = async (clientId: string) => {
    setBusyClientId(clientId);
    setClientActionError("");
    try {
      const result = await removeSupervisorClient(clientId);
      if (!result.ok) {
        throw new Error("The client could not be removed.");
      }
      const removedClient = assignedClientState.find((client) => client.id === clientId);
      setAssignedClientState((previous) =>
        previous.filter((client) => client.id !== clientId)
      );
      if (removedClient) {
        setAvailableClientState((previous) => {
          if (previous.some((client) => client.id === removedClient.id)) {
            return previous;
          }
          return [
            ...previous,
            {
              id: removedClient.id,
              firstName: removedClient.firstName,
              lastName: removedClient.lastName,
            },
          ];
        });
      }
      if (activeClientId === clientId) {
        const nextClient = assignedClientState.find((client) => client.id !== clientId);
        setActiveClientId(nextClient?.id);
      }
      returnOneDashboardLayer();
    } catch (error) {
      setClientActionError(
        error instanceof Error ? error.message : "The client could not be removed."
      );
    } finally {
      setBusyClientId(null);
    }
  };

  const onAddClient = async (clientId: string) => {
    setBusyClientId(clientId);
    setClientActionError("");
    try {
      const result = await addSupervisorClient(clientId);
      if (!result.ok) {
        throw new Error("The client could not be linked.");
      }
      const addedClient = availableClientState.find((client) => client.id === clientId);
      if (addedClient) {
        setAssignedClientState((previous) => [
          ...previous,
          {
            id: addedClient.id,
            firstName: addedClient.firstName,
            lastName: addedClient.lastName,
            providerClients: [],
            entries: [],
            recentEntries: [],
          },
        ]);
        setAvailableClientState((previous) =>
          previous.filter((client) => client.id !== clientId)
        );
        setRecentlyAddedClientId(clientId);
      }
      returnOneDashboardLayer();
    } catch (error) {
      setClientActionError(
        error instanceof Error ? error.message : "The client could not be linked."
      );
    } finally {
      setBusyClientId(null);
    }
  };

  const confirmPendingClientAction = async () => {
    const action = pendingClientAction;
    if (!action || busyClientId) return;

    setPendingClientAction(null);
    if (action.type === "add") {
      await onAddClient(action.clientId);
      return;
    }
    await onRemoveClient(action.clientId);
  };

  const handleActiveClientChange = useCallback(
    (clientId: string) => {
      if (clientId !== activeClientId) {
        setInsightsOpen(false);
        setActiveClientId(clientId);
        const layer = window.history.state?.[DASHBOARD_HISTORY_KEY] as
          | { mode?: Mode; insightsOpen?: boolean }
          | undefined;
        if (layer?.mode === "orbit") {
          window.history.replaceState(
            {
              ...window.history.state,
              [DASHBOARD_HISTORY_KEY]: {
                ...layer,
                activeClientId: clientId,
                insightsOpen: false,
              },
            },
            ""
          );
        }
      }
    },
    [activeClientId]
  );

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
        className="back-link"
        onClick={() => {
          returnOneDashboardLayer();
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
    ) : mode === "grid" || mode === "add" || mode === "remove" ? (
      <button
        type="button"
        className="back-link"
        onClick={() => {
          if (mode === "grid") return;
          returnOneDashboardLayer();
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
        Client List
      </button>
    ) : null;

  const activeClient = assignedClientState.find((client) => client.id === activeClientId);
  const content =
    assignedClientState.length === 0 && mode === "grid" ? (
      <FirstClientEmptyState />
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
          onTeamFocusSaved={(clientId, teamFocus) => {
            setAssignedClientState((currentClients) =>
              currentClients.map((client) =>
                client.id === clientId
                  ? {
                      ...client,
                      teamFocusItems: [teamFocus],
                    }
                  : client
              )
            );
          }}
        />
        {activeClient ? (
          <InsightsOverlay
            clientId={activeClient.id}
            isOpen={insightsOpen}
            hasCaseSupportAccess={activeClient.hasCaseSupportAccess}
            onClose={returnOneDashboardLayer}
          />
        ) : null}
      </div>
    ) : mode === "grid" ? (
      <GridClientView
        clients={assignedClientState}
        palette={dashboardClientPalette}
        initialsOf={dashboardClientInitials}
        animatedClientId={recentlyAddedClientId ?? undefined}
        onClientClick={(clientId) => {
          pushDashboardLayer({
            mode: "orbit",
            activeClientId: clientId,
          });
        }}
      />
    ) : mode === "remove" ? (
      <RemoveClientView
        clients={assignedClientState}
        palette={dashboardClientPalette}
        initialsOf={dashboardClientInitials}
        busyClientId={busyClientId}
        onClientClick={(clientId, name) => {
          setPendingClientAction({ type: "remove", clientId, name });
        }}
      />
    ) : (
      <AddClientView
        clients={visibleAddClients}
        palette={dashboardClientPalette}
        initialsOf={dashboardClientInitials}
        busyClientId={busyClientId}
        onClientClick={(client) => {
          if (client.attached) {
            pushDashboardLayer({
              mode: "orbit",
              activeClientId: client.id,
            });
            return;
          }
          setPendingClientAction({
            type: "add",
            clientId: client.id,
            name: `${client.firstName} ${client.lastName}`,
          });
        }}
      />
    );

  const floatingMenu =
    mode === "grid" || mode === "orbit" ? (
      <SupervisorDashboardMenu
        mode={mode}
        menuOpen={menuOpen}
        activeClientId={activeClientId}
        menuRef={menuRef}
        onToggle={() => {
          if (menuOpen) {
            closeDashboardMenu();
            return;
          }
          pushDashboardLayer({
            mode,
            activeClientId,
            insightsOpen,
            menuOpen: true,
          });
        }}
        onClose={() =>
          replaceDashboardLayer({
            mode,
            activeClientId,
            insightsOpen,
          })
        }
        onOpenLinkClient={() => {
          replaceDashboardLayer({
            mode: "add",
            activeClientId,
          });
        }}
        onOpenRemoveClient={() => {
          replaceDashboardLayer({
            mode: "remove",
            activeClientId,
          });
        }}
        onOpenInsights={() => {
          replaceDashboardLayer({
            mode: "orbit",
            activeClientId,
            insightsOpen: true,
          });
        }}
        onOpenGuide={() => {
          replaceDashboardLayer({
            mode,
            activeClientId,
            insightsOpen,
          });
          setGuideOpen(true);
        }}
      />
    ) : null;

  return (
    <>
      <DashboardWorkspaceLayout
        topNav={mode === "grid" ? null : topNav}
        notice={
          mode === "grid" && caseSupportRequests.length > 0 ? (
            <CaseSupportRequestNotice requests={caseSupportRequests} />
          ) : null
        }
        content={content}
        floatingMenu={floatingMenu}
        onContentPointerDown={(event) => {
          if (
            (mode !== "add" && mode !== "remove") ||
            pendingClientAction ||
            !(event.target instanceof Element) ||
            event.target.closest(".client-cavity-tray")
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
  const isRemoving = action.type === "remove";

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
      onClick={onCancel}
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
          {isRemoving ? "Remove Client" : "Link Client"}
        </div>
        <div style={{ lineHeight: 1.5, opacity: 0.72 }}>
          {isRemoving
            ? `Remove ${action.name} from your dashboard? The client record will remain available to other assigned providers.`
            : `Link ${action.name} to your supervisor dashboard?`}
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
            className={isRemoving ? "action-negative" : "action-positive"}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Working..." : isRemoving ? "Remove" : "Link"}
          </button>
        </div>
      </div>
    </div>
  );
}
