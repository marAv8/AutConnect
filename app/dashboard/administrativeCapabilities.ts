export type AdministrativePresentationCapabilities = {
  canAccessPlatformAdministration: boolean;
  canInviteTeam: boolean;
  canAddClient: boolean;
  canAttachExistingClient: boolean;
  canReviewOrganizationInvitations: boolean;
  canLinkClient: false;
  removableClientIds: string[];
  careTeamClientIds: string[];
};

type AdministrativeCapabilityInput = {
  providerRole: string;
  sessionRole: string;
  providerStatus: string;
  isPlatformAdministrator: boolean;
  administeredOrganizationIds: readonly string[];
  assignedClientIds: readonly string[];
  teamManagedClientIds: readonly string[];
};

function uniqueIds(ids: readonly string[]) {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function deriveAdministrativePresentationCapabilities({
  providerRole,
  sessionRole,
  providerStatus,
  isPlatformAdministrator,
  administeredOrganizationIds,
  assignedClientIds,
  teamManagedClientIds,
}: AdministrativeCapabilityInput): AdministrativePresentationCapabilities {
  const isActive =
    providerStatus === "ACTIVE" && providerRole === sessionRole;
  const isSupervisor = isActive && providerRole === "Supervisor";
  const hasDirectOrganizationAdministration =
    isActive && administeredOrganizationIds.length > 0;
  const removableClientIds = isSupervisor ? uniqueIds(assignedClientIds) : [];
  const assignedClientIdSet = new Set(removableClientIds);
  const careTeamClientIds = isSupervisor
    ? uniqueIds(teamManagedClientIds).filter((clientId) =>
        assignedClientIdSet.has(clientId)
      )
    : [];

  return {
    canAccessPlatformAdministration:
      isActive && isPlatformAdministrator,
    canInviteTeam: hasDirectOrganizationAdministration,
    canAddClient: isSupervisor && hasDirectOrganizationAdministration,
    canAttachExistingClient: hasDirectOrganizationAdministration,
    canReviewOrganizationInvitations: hasDirectOrganizationAdministration,
    canLinkClient: false,
    removableClientIds,
    careTeamClientIds,
  };
}
