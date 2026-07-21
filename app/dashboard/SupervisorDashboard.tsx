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
import SupervisorWorkspaceLayout from "./SupervisorWorkspaceLayout";
import GridClientView from "./GridClientView";
import OrbitView from "./OrbitView";
import AddClientView from "./AddClientView";
import RemoveClientView from "./RemoveClientView";
import FirstClientEmptyState from "./FirstClientEmptyState";
import InsightsOverlay from "./InsightsOverlay";
import SupervisorDashboardMenu from "./SupervisorDashboardMenu";
import type { DashboardClient } from "./dashboardClientTypes";
import {
  markDashboardProviderEntriesRead,
  projectDashboardEntrySaved,
} from "./clientCarouselModel";

type AvailableClient = {
  id: string;
  firstName: string;
  lastName: string;
};

type Props = {
  assignedClients: DashboardClient[];
  availableClients: AvailableClient[];
  currentProviderId: string;
  initialClientId?: string;
  forceOrbitView?: boolean;
};

type Mode = "grid" | "orbit" | "remove" | "add";

const palette = [
  "#e1e1e1",
  "#ededed",
  "#d9d9d9",
  "#f4f4f4",
  "#e6e6e6",
  "#eeeeee",
  "#d5d5d5",
];

const initialsOf = (firstName: string, lastName: string) =>
  `${firstName.slice(0, 2)}${lastName.slice(0, 2)}`;

export default function SupervisorDashboard({
  assignedClients,
  availableClients,
  currentProviderId,
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
  const [recentlyAddedClientId, setRecentlyAddedClientId] = useState<string | null>(null);

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
        setMenuOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!recentlyAddedClientId) return;

    const timeout = window.setTimeout(() => {
      setRecentlyAddedClientId(null);
    }, 450);

    return () => window.clearTimeout(timeout);
  }, [recentlyAddedClientId]);

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

  const onRemoveClient = async (clientId: string, name: string) => {
    const ok = window.confirm(
      `Remove ${name} from your dashboard? This only detaches your supervisor assignment.`
    );
    if (!ok) return;

    setBusyClientId(clientId);
    try {
      await removeSupervisorClient(clientId);
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
      setMode("grid");
    } finally {
      setBusyClientId(null);
    }
  };

  const onAddClient = async (clientId: string, name: string) => {
    const ok = window.confirm(`Add ${name} to your dashboard?`);
    if (!ok) return;

    setBusyClientId(clientId);
    try {
      await addSupervisorClient(clientId);
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
      setMode("grid");
    } finally {
      setBusyClientId(null);
    }
  };

  const handleActiveClientChange = useCallback(
    (clientId: string) => {
      if (clientId !== activeClientId) {
        setInsightsOpen(false);
        setActiveClientId(clientId);
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
          setInsightsOpen(false);
          setMode("grid");
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
          setInsightsOpen(false);
          setMode("grid");
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
            onClose={() => setInsightsOpen(false)}
          />
        ) : null}
      </div>
    ) : mode === "grid" ? (
      <GridClientView
        clients={assignedClientState}
        palette={palette}
        initialsOf={initialsOf}
        animatedClientId={recentlyAddedClientId ?? undefined}
        onClientClick={(clientId) => {
          setInsightsOpen(false);
          setActiveClientId(clientId);
          setMode("orbit");
        }}
      />
    ) : mode === "remove" ? (
      <RemoveClientView
        clients={assignedClientState}
        palette={palette}
        initialsOf={initialsOf}
        busyClientId={busyClientId}
        onClientClick={(clientId, name) => {
          void onRemoveClient(clientId, name);
        }}
      />
    ) : (
      <AddClientView
        clients={visibleAddClients}
        palette={palette}
        initialsOf={initialsOf}
        busyClientId={busyClientId}
        onClientClick={(client) => {
          if (client.attached) {
            setActiveClientId(client.id);
            setMode("orbit");
            return;
          }
          void onAddClient(client.id, `${client.firstName} ${client.lastName}`);
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
        onToggle={() => setMenuOpen((value) => !value)}
        onClose={() => setMenuOpen(false)}
        onOpenLinkClient={() => {
          setMode("add");
          setMenuOpen(false);
        }}
        onOpenRemoveClient={() => {
          setMode("remove");
          setMenuOpen(false);
        }}
        onOpenInsights={() => {
          setInsightsOpen(true);
          setMenuOpen(false);
        }}
      />
    ) : null;

  return (
    <SupervisorWorkspaceLayout
      topNav={topNav}
      content={content}
      floatingMenu={floatingMenu}
    />
  );
}
