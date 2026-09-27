import ClientCarousel from "./ClientCarousel";
import ModeContentFrame from "./ModeContentFrame";
import type { DashboardClient, DashboardTeamFocus } from "./dashboardClientTypes";
import type { DashboardArrivalCoordinator } from "./clientListEntrance";

type Props = {
  clients: DashboardClient[];
  currentProviderId: string;
  viewerRole?: string;
  activeClientId?: string;
  onActiveClientChange: (clientId: string) => void;
  onEntryRead?: (
    clientId: string,
    authorProviderId: string,
    entryIds: string[]
  ) => void;
  onClientSignalRead?: (clientId: string) => void;
  onEntrySaved?: (
    clientId: string,
    authorProviderId: string,
    entryId: string,
    visibility?: "Private" | "Shared",
    status?: string
  ) => void;
  onTeamFocusSaved?: (clientId: string, teamFocus: DashboardTeamFocus) => void;
  onFocusedDataEntryChange?: (active: boolean) => void;
  arrivalCoordinator: DashboardArrivalCoordinator;
};

export default function OrbitView({
  clients,
  currentProviderId,
  viewerRole,
  activeClientId,
  onActiveClientChange,
  onEntryRead,
  onClientSignalRead,
  onEntrySaved,
  onTeamFocusSaved,
  onFocusedDataEntryChange,
  arrivalCoordinator,
}: Props) {
  if (clients.length === 0) return null;

  return (
    <ModeContentFrame>
      <ClientCarousel
        clients={clients}
        currentProviderId={currentProviderId}
        viewerRole={viewerRole}
        initialClientId={activeClientId}
        onActiveClientChange={onActiveClientChange}
        onEntryRead={onEntryRead}
        onClientSignalRead={onClientSignalRead}
        onEntrySaved={onEntrySaved}
        onTeamFocusSaved={onTeamFocusSaved}
        onFocusedDataEntryChange={onFocusedDataEntryChange}
        arrivalCoordinator={arrivalCoordinator}
      />
    </ModeContentFrame>
  );
}
