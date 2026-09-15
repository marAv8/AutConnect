export const PUBLIC_PROVIDER_ROLES = [
  "Educator",
  "SpeechPathologist",
  "Caregiver",
  "BehaviorTherapist",
  "OccupationalTherapist",
] as const;

export type PublicProviderRole = (typeof PUBLIC_PROVIDER_ROLES)[number];

export function isPublicProviderRole(role: string): role is PublicProviderRole {
  return (PUBLIC_PROVIDER_ROLES as readonly string[]).includes(role);
}

export function invitationMembershipRole(providerRole: string) {
  return providerRole === "Supervisor" ? "ADMIN" : "MEMBER";
}

export function canAcceptInvitationRole(
  currentRole: string | null | undefined,
  invitedRole: string
) {
  return !currentRole || currentRole === invitedRole;
}
