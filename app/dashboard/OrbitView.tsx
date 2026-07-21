import ClientCarousel from "./ClientCarousel";
import ModeContentFrame from "./ModeContentFrame";
import type { DashboardClient, DashboardTeamFocus } from "./dashboardClientTypes";

type Props = {
  clients: DashboardClient[];
  currentProviderId: string;
  viewerRole?: string;
  activeClientId?: string;
  onActiveClientChange: (clientId: string) => void;
  onEntryRead?: (clientId: string, authorProviderId: string) => void;
  onEntrySaved?: (
    clientId: string,
    authorProviderId: string,
    entryId: string,
    visibility?: "Private" | "Shared",
    status?: string
  ) => void;
  onTeamFocusSaved?: (clientId: string, teamFocus: DashboardTeamFocus) => void;
};

export default function OrbitView({
  clients,
  currentProviderId,
  viewerRole,
  activeClientId,
  onActiveClientChange,
  onEntryRead,
  onEntrySaved,
  onTeamFocusSaved,
}: Props) {
  if (clients.length === 0) return null;

  return (
    <ModeContentFrame>
      <ClientCarousel
        key={activeClientId ?? "orbit"}
        clients={clients}
        currentProviderId={currentProviderId}
        viewerRole={viewerRole}
        initialClientId={activeClientId}
        onActiveClientChange={onActiveClientChange}
        onEntryRead={onEntryRead}
        onEntrySaved={onEntrySaved}
        onTeamFocusSaved={onTeamFocusSaved}
      />
    </ModeContentFrame>
  );
}
