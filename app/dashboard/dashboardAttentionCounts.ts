import { db } from "@/lib/db";
import { isPlatformAdminEmail } from "@/lib/platformAdminPolicy";
import { normalizeInvitationEmail } from "@/lib/organizationInvitations";
import { emptyDashboardAttentionCounts, type DashboardAttentionCounts } from "./dashboardAttentionTypes";

// Server-only caller supplies the freshly loaded account and the exact Client
// manager IDs already authorized for dashboard Care Team navigation. Never use
// URL parameters or browser-provided IDs here; no additional per-Client queries.
export async function getDashboardAttentionCounts({ provider, sessionRole, authorizedTeamClientIds, now = new Date() }: {
  provider: { email: string; role: string; status: string };
  sessionRole: string;
  authorizedTeamClientIds: readonly string[];
  now?: Date;
}): Promise<DashboardAttentionCounts> {
  if (provider.status !== "ACTIVE" || provider.role !== sessionRole) {
    return { ...emptyDashboardAttentionCounts };
  }
  const canManageClients = provider.role === "Supervisor" && authorizedTeamClientIds.length > 0;
  const [organizationAccessRequests, myOrganizationInvitations, clientParticipationRequests] = await Promise.all([
    isPlatformAdminEmail(provider.email)
      ? db.agencyAccessRequest.count({ where: { status: "PENDING", reviewedAt: null } })
      : null,
    db.organizationInvitation.count({ where: {
      normalizedEmail: normalizeInvitationEmail(provider.email),
      acceptedAt: null, revokedAt: null, expiresAt: { gt: now },
    } }),
    canManageClients
      ? db.clientAttachRequest.count({ where: {
          clientId: { in: [...authorizedTeamClientIds] }, status: "PENDING", decidedAt: null,
        } })
      : null,
  ]);
  return { organizationAccessRequests, myOrganizationInvitations, clientParticipationRequests };
}
