/**
 * Shared dashboard data contract for the client carousel and orbit.
 * Keeping this contract independent from layout code lets future UI work change
 * positioning without changing note, unread, or Team Focus semantics.
 */

export type DashboardProviderClient = {
  role: string;
  provider: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export type DashboardEntryState = {
  id: string;
  providerId: string;
  kind?: string;
  visibility?: string;
  status?: string;
  reads?: { readAt: Date | string | null }[];
};

export type DashboardRecentEntryState = {
  id: string;
  providerId: string;
  status?: string;
};

export type DashboardTeamFocus = {
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

export type DashboardClient = {
  id: string;
  firstName: string;
  lastName: string;
  providerClients: DashboardProviderClient[];
  entries?: DashboardEntryState[];
  recentEntries?: DashboardRecentEntryState[];
  teamFocusItems?: DashboardTeamFocus[];
};

export type DashboardEntryMutation =
  | {
      type: "read";
      clientId: string;
      authorProviderId: string;
    }
  | {
      type: "saved";
      clientId: string;
      authorProviderId: string;
      entryId: string;
      kind?: string;
      visibility?: string;
      status?: string;
    };
