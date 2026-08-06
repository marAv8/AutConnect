"use client";

import { useCallback, useEffect, useState } from "react";
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

type Props = {
  clients: DashboardClient[];
  currentProviderId: string;
  viewerRole: string;
  initialClientId?: string;
  forceOrbitView?: boolean;
  clientListLabel: string;
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

export default function ProviderDashboard({
  clients,
  currentProviderId,
  viewerRole,
  initialClientId,
  forceOrbitView = false,
  clientListLabel,
  caseSupportUpdates = [],
}: Props) {
  const canOpenOrbit =
    forceOrbitView &&
    !!initialClientId &&
    clients.some((client) => client.id === initialClientId);
  const [clientState, setClientState] = useState(clients);
  const [mode, setMode] = useState<Mode>(canOpenOrbit ? "orbit" : "grid");
  const [activeClientId, setActiveClientId] = useState<string | undefined>(
    canOpenOrbit ? initialClientId ?? clients[0]?.id : clients[0]?.id
  );
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    setClientState(clients);
  }, [clients]);

  const handleEntryRead = useCallback(
    (clientId: string, authorProviderId: string) => {
      setClientState((currentClients) =>
        markDashboardProviderEntriesRead(
          currentClients,
          clientId,
          authorProviderId
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
      className="back-link"
      onClick={() => setMode("grid")}
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
        onActiveClientChange={setActiveClientId}
        onEntryRead={handleEntryRead}
        onClientSignalRead={handleClientSignalRead}
        onEntrySaved={handleEntrySaved}
      />
    ) : (
      <GridClientView
        clients={clientState}
        palette={dashboardClientPalette}
        initialsOf={dashboardClientInitials}
        onClientClick={(clientId) => {
          setActiveClientId(clientId);
          setMode("orbit");
        }}
      />
    );

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
        floatingMenu={
          <div className="dashboard-utility-controls">
            <button
              type="button"
              className="material-control dashboard-round-icon-control dashboard-info-control"
              aria-label="How AutConnect works"
              onClick={() => setGuideOpen(true)}
            >
              <Info aria-hidden="true" size={22} strokeWidth={1.8} />
            </button>
            <ThemeToggle />
          </div>
        }
      />
      {guideOpen ? <DashboardProductGuide onClose={() => setGuideOpen(false)} /> : null}
    </>
  );
}
