// Only aggregate counts cross the server/client boundary. Null means no access.
export type DashboardAttentionCounts = {
  organizationAccessRequests: number | null;
  myOrganizationInvitations: number;
  clientParticipationRequests: number | null;
};

export const emptyDashboardAttentionCounts: DashboardAttentionCounts = {
  organizationAccessRequests: null,
  myOrganizationInvitations: 0,
  clientParticipationRequests: null,
};
