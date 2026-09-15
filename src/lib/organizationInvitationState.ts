export type InvitationFailure = "unavailable" | "expired" | "revoked" | "wrong-account" | "role-mismatch" | "inactive-account" | "access-removed" | "retry" | "confirm-replacement" | "already-accepted" | "owner-invitation" | "recipient-unchanged";

export class OrganizationInvitationError extends Error {
  constructor(public readonly code: InvitationFailure) {
    super(code);
    this.name = "OrganizationInvitationError";
  }
}

export function invitationAuthPath(path: "/login" | "/create-account", token: string, error?: string) {
  const query = new URLSearchParams();
  if (error) query.set("error", error);
  if (token) query.set("invite", token);
  return query.size ? `${path}?${query}` : path;
}

export function invitationFailureMessage(code: InvitationFailure) {
  return {
    unavailable: "This invitation link is not available. Ask your organization administrator for the latest link.",
    expired: "This invitation has expired. Ask your organization administrator to reissue it.",
    revoked: "This invitation was revoked or replaced. Use the latest link from your organization administrator.",
    "wrong-account": "This invitation does not match your signed-in account. Ask the administrator to check the recipient email for a typo and issue a corrected invitation. No membership was added.",
    "role-mismatch": "The invited role does not match your account. Ask the administrator to reissue the invitation for your current role.",
    "inactive-account": "Your account is not active. Contact your organization administrator before accepting.",
    "access-removed": "This invitation was already accepted, but membership is no longer active. Ask an organization administrator for a new invitation.",
    retry: "The invitation could not be processed. No access change was completed. Try again; if this continues, contact your administrator.",
    "confirm-replacement": "An unused invitation already exists. Confirm that its link should stop working before creating a replacement.",
    "already-accepted": "This invitation was already accepted. Review the active member instead; invitation actions do not remove membership.",
    "owner-invitation": "Owner invitations require platform administration. This invitation cannot be reissued here.",
    "recipient-unchanged": "The corrected email is the same as the invited email. Enter the corrected address, or use Reissue Link to keep this recipient.",
  }[code];
}

export function invitationStatus(invitation: {
  acceptedAt: Date | string | null; revokedAt: Date | string | null; expiresAt: Date | string;
}, now = new Date()) {
  if (invitation.acceptedAt) return "Accepted";
  if (invitation.revokedAt) return "Revoked";
  if (new Date(invitation.expiresAt) <= now) return "Expired";
  return "Pending";
}

type InvitationHistoryRecord = {
  acceptedAt: Date | string | null; revokedAt: Date | string | null; expiresAt: Date | string;
  organizationId: string; normalizedEmail: string; createdAt: Date | string;
};
export function invitationHistoryStatus(invitation: InvitationHistoryRecord, history: InvitationHistoryRecord[]) {
  if (!invitation.acceptedAt && invitation.revokedAt && history.some(candidate =>
    candidate.organizationId === invitation.organizationId && candidate.normalizedEmail === invitation.normalizedEmail &&
    new Date(candidate.createdAt) > new Date(invitation.createdAt)
  )) return "Replaced";
  return invitationStatus(invitation);
}

// Only accept the existing invitation-link shapes, never an arbitrary return URL.
export function invitationTokenFromLink(value: string) {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || !["/create-account", "/login"].includes(url.pathname)) return "";
    const token = url.searchParams.get("invite") ?? "";
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "";
  } catch { return ""; }
}

export function invitationLinkError(value: string) {
  if (invitationTokenFromLink(value.trim())) return null;
  try {
    const url = new URL(value.trim());
    if (url.pathname === "/login" && !url.searchParams.get("invite")) {
      return "This is an ordinary login URL, not an invitation. Ask your administrator to use Copy Link on the freshly issued invitation, then paste that complete link here.";
    }
  } catch { /* A malformed link uses the same bounded, non-secret feedback. */ }
  return "Paste the complete invitation link shared by your organization administrator, including its invitation code.";
}

export async function copyInvitationLink(link: string, writeText: (value: string) => Promise<void>) {
  try {
    await writeText(link);
    return "Link copied.";
  } catch {
    return "Copy was unavailable. Select the link above and copy it manually.";
  }
}
