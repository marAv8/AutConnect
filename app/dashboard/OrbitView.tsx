import ClientCarousel from "./ClientCarousel";
import ModeContentFrame from "./ModeContentFrame";

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
  kind?: string;
  visibility?: string;
  status?: string;
  reads?: { readAt: Date | string | null }[];
};

type RecentEntryState = {
  id: string;
  providerId: string;
  status?: string;
};

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  providerClients: ProviderClient[];
  entries?: EntryState[];
  recentEntries?: RecentEntryState[];
  teamFocusItems?: TeamFocusData[];
};

type TeamFocusData = {
  id: string;
  title?: string | null;
  content: string;
  updatedAt: Date | string;
  author: {
    firstName: string;
    lastName: string;
    role: string;
  };
};

type Props = {
  clients: Client[];
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
  onTeamFocusSaved?: (clientId: string, teamFocus: TeamFocusData) => void;
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
