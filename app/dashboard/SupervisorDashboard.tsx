//app/dashboard/SupervisorDashboard.tsx
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
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

type ProviderClient = {
  role: string;
  provider: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

type EntryState = {
  id: string;
  providerId: string;
  reads?: { readAt: Date | string | null }[];
};

type RecentEntryState = {
  id: string;
  providerId: string;
};

type AssignedClient = {
  id: string;
  firstName: string;
  lastName: string;
  providerClients: ProviderClient[];
  entries?: EntryState[];
  recentEntries?: RecentEntryState[];
};

type AvailableClient = {
  id: string;
  firstName: string;
  lastName: string;
};

type Props = {
  assignedClients: AssignedClient[];
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

const menuStackStyle: React.CSSProperties = {
  position: "relative",
  width: 58,
  height: 58,
};

const menuPanelStyle: React.CSSProperties = {
  position: "absolute",
  left: 0,
  bottom: "calc(100% + 16px)",
  display: "grid",
  gap: 12,
  minWidth: 154,
  padding: 0,
  justifyItems: "center",
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

const menuActionStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  minHeight: 42,
  border: "none",
  borderRadius: 14,
  background: "var(--note-neo-surface)",
  textAlign: "center",
  textDecoration: "none",
  padding: "0 16px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 650,
  color: "rgb(0 0 0 / 82%)",
  boxShadow: "var(--note-neo-control)",
};

const menuButtonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 58,
  height: 58,
  borderRadius: "50%",
  border: "none",
  background: "var(--note-neo-surface)",
  color: "var(--foreground)",
  fontSize: 28,
  lineHeight: 1,
  cursor: "pointer",
  boxShadow: "var(--note-neo-control)",
};

const menuDotRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 10,
};

const menuDotStyle: React.CSSProperties = {
  width: 5,
  height: 5,
  borderRadius: "50%",
  background: "currentColor",
  display: "block",
};

function MenuDots() {
  return (
    <span aria-hidden="true" style={menuDotRowStyle}>
      <span style={menuDotStyle} />
      <span style={menuDotStyle} />
      <span style={menuDotStyle} />
    </span>
  );
}

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
    useState<AssignedClient[]>(assignedClients);
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
        currentClients.map((client) => {
          if (client.id !== clientId) return client;

          return {
            ...client,
            entries: client.entries?.map((entry) =>
              entry.providerId === authorProviderId
                ? {
                    ...entry,
                    reads: [{ readAt: new Date() }],
                  }
                : entry
            ),
          };
        })
      );
    },
    []
  );

  const handleEntrySaved = useCallback(
    (clientId: string, authorProviderId: string, entryId: string) => {
      setAssignedClientState((currentClients) =>
        currentClients.map((client) => {
          if (client.id !== clientId) return client;

          const entries = client.entries ?? [];
          const hasEntry = entries.some((entry) => entry.id === entryId);

          return {
            ...client,
            entries: hasEntry
              ? entries.map((entry) =>
                  entry.id === entryId
                    ? {
                        ...entry,
                        providerId: authorProviderId,
                        reads:
                          authorProviderId === currentProviderId
                            ? [{ readAt: null }]
                            : entry.reads,
                      }
                    : entry
                )
              : [
                  ...entries,
                  {
                    id: entryId,
                    providerId: authorProviderId,
                    reads: [{ readAt: null }],
                  },
                ],
            recentEntries: client.recentEntries?.some((entry) => entry.id === entryId)
              ? client.recentEntries
              : [
                  ...(client.recentEntries ?? []),
                  { id: entryId, providerId: authorProviderId },
                ],
          };
        })
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
          activeClientId={activeClientId}
          onActiveClientChange={handleActiveClientChange}
          onEntryRead={handleEntryRead}
          onEntrySaved={handleEntrySaved}
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
    mode === "grid" ? (
      <div ref={menuRef} style={menuStackStyle}>
        {menuOpen && (
          <div style={menuPanelStyle}>
            <Link
              href="/portal/supervisor/create-client"
              className="soft-link"
              style={menuActionStyle}
            >
              Add Client
            </Link>
            <button
              type="button"
              onClick={() => {
                setMode("add");
                setMenuOpen(false);
              }}
              style={menuActionStyle}
            >
              Link Client
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("remove");
                setMenuOpen(false);
              }}
              style={menuActionStyle}
            >
              Remove Client
            </button>
          </div>
        )}
        <button
          type="button"
          className="material-control"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-label="More"
          style={menuButtonStyle}
        >
          <MenuDots />
        </button>
      </div>
    ) : mode === "orbit" ? (
      <div ref={menuRef} style={menuStackStyle}>
        {menuOpen && (
          <div style={menuPanelStyle}>
            {activeClientId ? (
              <Link
                href={`/portal/supervisor/edit-providers/${activeClientId}`}
                onClick={() => setMenuOpen(false)}
                className="soft-link"
                style={menuActionStyle}
              >
                Care Team
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setInsightsOpen(true);
                setMenuOpen(false);
              }}
              style={menuActionStyle}
            >
              Insights
            </button>
          </div>
        )}
        <button
          type="button"
          className="material-control"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-label="More"
          style={menuButtonStyle}
        >
          <MenuDots />
        </button>
      </div>
    ) : null;

  return (
    <SupervisorWorkspaceLayout
      topNav={topNav}
      content={content}
      floatingMenu={floatingMenu}
    />
  );
}
