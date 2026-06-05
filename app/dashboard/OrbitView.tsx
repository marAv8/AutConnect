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
  reads?: { readAt: Date | string | null }[];
};

type RecentEntryState = {
  id: string;
  providerId: string;
};

type Client = {
  id: string;
  firstName: string;
  lastName: string;
  providerClients: ProviderClient[];
  entries?: EntryState[];
  recentEntries?: RecentEntryState[];
};

type Props = {
  clients: Client[];
  currentProviderId: string;
  activeClientId?: string;
  onActiveClientChange: (clientId: string) => void;
  onEntryRead?: (clientId: string, authorProviderId: string) => void;
  onEntrySaved?: (clientId: string, authorProviderId: string, entryId: string) => void;
};

export default function OrbitView({
  clients,
  currentProviderId,
  activeClientId,
  onActiveClientChange,
  onEntryRead,
  onEntrySaved,
}: Props) {
  if (clients.length === 0) return null;

  return (
    <ModeContentFrame>
      <ClientCarousel
        key={activeClientId ?? "orbit"}
        clients={clients}
        currentProviderId={currentProviderId}
        initialClientId={activeClientId}
        onActiveClientChange={onActiveClientChange}
        onEntryRead={onEntryRead}
        onEntrySaved={onEntrySaved}
      />
    </ModeContentFrame>
  );
}
