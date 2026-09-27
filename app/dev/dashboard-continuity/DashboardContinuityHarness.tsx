"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import ClientCarousel from "@/app/dashboard/ClientCarousel";
import type { DashboardClient } from "@/app/dashboard/dashboardClientTypes";
import {
  SUPERVISOR_DASHBOARD_HISTORY_KEY,
  gridNavigationProvenance,
  orbitNavigationProvenance,
} from "@/app/dashboard/dashboardNavigation";
import {
  attachDashboardOrbitReturnMarker,
  dashboardOrbitPresentationKey,
} from "@/app/dashboard/dashboardOrbitRestoration";
import DashboardWorkspaceLayout from "@/app/dashboard/DashboardWorkspaceLayout";
import DashboardInboxControl from "@/app/dashboard/DashboardInboxControl";
import SupervisorDashboard from "@/app/dashboard/SupervisorDashboard";
import ProviderDashboard from "@/app/dashboard/ProviderDashboard";
import { createDashboardArrivalCoordinator } from "@/app/dashboard/clientListEntrance";

const supervisorProviderId = "continuity-supervisor";
const behaviorProviderId = "continuity-provider-a";
const clients: DashboardClient[] = [
  {
    id: "continuity-client-a",
    firstName: "Alpha",
    lastName: "Client",
    providerClients: [
      {
        role: "Supervisor",
        provider: { id: supervisorProviderId, firstName: "Sam", lastName: "Lead" },
      },
      {
        role: "BehaviorTherapist",
        provider: { id: behaviorProviderId, firstName: "Bea", lastName: "One" },
      },
      {
        role: "SpeechPathologist",
        provider: { id: "continuity-provider-b", firstName: "Sky", lastName: "Two" },
      },
    ],
  },
  {
    id: "continuity-client-b",
    firstName: "Beta",
    lastName: "Client",
    providerClients: [
      {
        role: "Supervisor",
        provider: { id: supervisorProviderId, firstName: "Sam", lastName: "Lead" },
      },
      {
        role: "Educator",
        provider: { id: "continuity-provider-c", firstName: "Eli", lastName: "Three" },
      },
    ],
  },
];

export default function DashboardContinuityHarness({ initialOwners = false, initialProvider = false, initialOrbit = false, occupational = false }: { initialOwners?: boolean; initialProvider?: boolean; initialOrbit?: boolean; occupational?: boolean }) {
  const router = useRouter();
  const [isProviderJourney] = useState(initialProvider);
  const [useOwners] = useState(initialOwners);
  const currentProviderId = isProviderJourney
    ? behaviorProviderId
    : supervisorProviderId;
  const viewerRole = isProviderJourney ? (occupational ? "OccupationalTherapist" : "BehaviorTherapist") : "Supervisor";
  const arrivalCoordinator = useMemo(
    () => createDashboardArrivalCoordinator(currentProviderId),
    [currentProviderId]
  );
  const client = clients[0];
  const prepareReturn = () => {
    const grid = gridNavigationProvenance(
      "supervisor",
      "continuity-root",
      client.id
    );
    const navigation = orbitNavigationProvenance(grid, client.id);
    const historyState = {
      ...window.history.state,
      [SUPERVISOR_DASHBOARD_HISTORY_KEY]: {
        mode: "orbit",
        activeClientId: client.id,
        navigation,
      },
    };
    window.history.replaceState(
      attachDashboardOrbitReturnMarker({
        historyState,
        clientId: client.id,
        rootId: navigation.rootId,
        presentationKey: dashboardOrbitPresentationKey(client, currentProviderId),
      }),
      ""
    );
    router.push("/dev/dashboard-continuity/workflow");
  };

  // Opt-in coverage of the actual owners; the original continuity fixture stays intact.
  if (useOwners) {
    const ownerClients = clients.map((item) => ({
      ...item,
      providerClients: item.providerClients.map(assignment => assignment.provider.id === behaviorProviderId && occupational
        ? { ...assignment, role: "OccupationalTherapist" as const } : assignment),
      hasCaseSupportAccess: true,
      entries: isProviderJourney && !occupational ? [{
        id: "synthetic-completed-note", providerId: behaviorProviderId,
        kind: "SessionNote", status: "COMPLETED", visibility: "Shared",
        reads: [{ readAt: "2026-09-08T12:00:00Z" }],
      }] : [],
    }));
    return isProviderJourney ? (
      <ProviderDashboard clients={ownerClients} currentProviderId={currentProviderId}
        viewerRole={viewerRole} clientListLabel="Client List"
        initialClientId={initialOrbit ? client.id : undefined} forceOrbitView={initialOrbit}
        canReviewOrganizationInvitations={!occupational} canAttachExistingClient={false}
        pendingOrganizationInvitationCount={0} />
    ) : (
      <SupervisorDashboard assignedClients={ownerClients} currentProviderId={currentProviderId}
        initialClientId={initialOrbit ? client.id : undefined} forceOrbitView={initialOrbit}
        newCaseSupportRequestCount={0} pendingOrganizationInvitationCount={0}
        administrativeCapabilities={{
          canAccessPlatformAdministration: false, canInviteTeam: false,
          canAddClient: false, canAttachExistingClient: false,
          canReviewOrganizationInvitations: true, canLinkClient: false,
          removableClientIds: [], careTeamClientIds: [],
        }} />
    );
  }

  return (
    <main style={{ display: "flex", width: "100%", minHeight: 0 }}>
      <button
        id="prepare-continuity-return"
        type="button"
        onClick={prepareReturn}
        style={{ position: "fixed", top: 8, left: 8, zIndex: 1000 }}
      >
        Enter workflow
      </button>
      <DashboardWorkspaceLayout
        topNav={null}
        content={
          <ClientCarousel
            clients={clients}
            currentProviderId={currentProviderId}
            viewerRole={viewerRole}
            initialClientId={client.id}
            onActiveClientChange={() => {}}
            arrivalCoordinator={arrivalCoordinator}
          />
        }
        floatingMenu={
          <div className="dashboard-utility-controls">
            <DashboardInboxControl
              canAccessCaseSupport
              canReviewOrganizationInvitations
              caseSupportCount={2}
              organizationInvitationCount={3}
            />
          </div>
        }
      />
    </main>
  );
}
