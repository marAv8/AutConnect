import type { OrganizationMembershipRole, Prisma } from "@prisma/client";

export const CLIENT_ATTACH_PUBLIC_RESPONSE =
  "If the case code is valid and eligible, the request will be reviewed.";

export const CLIENT_ATTACH_RATE_LIMIT = 5;
export const CLIENT_ATTACH_RATE_WINDOW_MS = 15 * 60 * 1000;
export const CLIENT_ATTACH_REASON_MAX_LENGTH = 256;

const ATTACH_ADMIN_ROLES: OrganizationMembershipRole[] = ["OWNER", "ADMIN"];

export type AttachMembershipSnapshot = {
  providerId: string;
  organizationId: string;
  role: OrganizationMembershipRole;
  active: boolean;
};

export function directAttachAdministratorWhere(
  providerId: string,
  organizationId: string
): Prisma.OrganizationMembershipWhereInput {
  return {
    providerId,
    organizationId,
    active: true,
    role: { in: ATTACH_ADMIN_ROLES },
    provider: { status: "ACTIVE" },
  };
}

export function canCreateClientAttachRequest(input: {
  actorId: string;
  organizationId: string;
  providerStatus: string;
  membership: AttachMembershipSnapshot | null;
  organizationParticipates: boolean;
  pendingRequestExists: boolean;
}) {
  const membership = input.membership;
  return (
    input.providerStatus === "ACTIVE" &&
    membership !== null &&
    membership.providerId === input.actorId &&
    membership.organizationId === input.organizationId &&
    membership.active &&
    ATTACH_ADMIN_ROLES.includes(membership.role) &&
    !input.organizationParticipates &&
    !input.pendingRequestExists
  );
}

export function isOrganizationAlreadyParticipating(input: {
  status: string;
  revokedAt: Date | null;
} | null) {
  return input?.status === "ACTIVE" && input.revokedAt === null;
}

export function canDecideClientAttachRequest(input: {
  actorId: string;
  clientId: string;
  providerStatus: string;
  assignment: { providerId: string; clientId: string; revokedAt: Date | null } | null;
  teamManager: { providerId: string; clientId: string; revokedAt: Date | null } | null;
}) {
  return (
    input.providerStatus === "ACTIVE" &&
    input.assignment?.providerId === input.actorId &&
    input.assignment.clientId === input.clientId &&
    input.assignment.revokedAt === null &&
    input.teamManager?.providerId === input.actorId &&
    input.teamManager.clientId === input.clientId &&
    input.teamManager.revokedAt === null
  );
}

export function canCancelClientAttachRequest(input: {
  actorId: string;
  organizationId: string;
  requestedById: string;
  providerStatus: string;
  membership: AttachMembershipSnapshot | null;
}) {
  const membership = input.membership;
  return (
    input.providerStatus === "ACTIVE" &&
    input.actorId === input.requestedById &&
    membership !== null &&
    membership.providerId === input.actorId &&
    membership.organizationId === input.organizationId &&
    membership.active &&
    ATTACH_ADMIN_ROLES.includes(membership.role)
  );
}

export function boundedAttachReason(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > CLIENT_ATTACH_REASON_MAX_LENGTH) {
    throw new Error("Attach-request reason is too long.");
  }
  return normalized;
}

export function attachRateLimitBucketStart(now: Date) {
  return new Date(
    Math.floor(now.getTime() / CLIENT_ATTACH_RATE_WINDOW_MS) *
      CLIENT_ATTACH_RATE_WINDOW_MS
  );
}

export function genericClientAttachResponse() {
  return {
    status: "submitted" as const,
    message: CLIENT_ATTACH_PUBLIC_RESPONSE,
  };
}
