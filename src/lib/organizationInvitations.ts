import type { Prisma } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { OrganizationInvitationError } from "./organizationInvitationState";
import { canAcceptInvitationRole } from "@/lib/invitationPolicy";

export const ORGANIZATION_INVITATION_LIFETIME_DAYS = 7;

export function normalizeInvitationEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createInvitationToken() {
  return randomBytes(32).toString("base64url");
}

export async function getAvailableOrganizationInvitation(token: string) {
  if (!token) return null;

  return db.organizationInvitation.findFirst({
    where: {
      tokenHash: hashInvitationToken(token),
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      email: true,
      normalizedEmail: true,
      providerRole: true,
      membershipRole: true,
      organizationId: true,
      organization: { select: { name: true } },
    },
  });
}

export async function acceptOrganizationInvitation(
  transaction: Prisma.TransactionClient,
  input: {
    token: string;
    email: string;
    providerId: string;
    currentRole?: string | null;
  }
) {
  const account = await transaction.provider.findUnique({
    where: { id: input.providerId },
    select: { email: true, role: true, status: true },
  });
  if (!account || account.status !== "ACTIVE") throw new OrganizationInvitationError("inactive-account");
  const normalizedEmail = normalizeInvitationEmail(account.email);
  if (normalizedEmail !== normalizeInvitationEmail(input.email)) throw new OrganizationInvitationError("wrong-account");
  const now = new Date();
  const invitation = await transaction.organizationInvitation.findUnique({
    where: { tokenHash: hashInvitationToken(input.token) },
    select: { id: true, normalizedEmail: true, organizationId: true, providerRole: true,
      membershipRole: true, acceptedAt: true, revokedAt: true, expiresAt: true,
      organization: { select: { name: true } } },
  });
  if (!invitation) throw new OrganizationInvitationError("unavailable");
  if (invitation.normalizedEmail !== normalizedEmail) throw new OrganizationInvitationError("wrong-account");
  if (!canAcceptInvitationRole(account.role, invitation.providerRole)) throw new OrganizationInvitationError("role-mismatch");
  const membershipKey = { organizationId_providerId: { organizationId: invitation.organizationId, providerId: input.providerId } };
  const existingMembership = await transaction.organizationMembership.findUnique({ where: membershipKey, select: { role: true, active: true } });
  // An accepted link may acknowledge an existing membership, never recreate access
  // or elevate it after an administrator has removed or changed that membership.
  if (invitation.acceptedAt) {
    if (!existingMembership?.active) throw new OrganizationInvitationError("access-removed");
    return invitation;
  }
  if (invitation.revokedAt) throw new OrganizationInvitationError("revoked");
  if (invitation.expiresAt <= now) throw new OrganizationInvitationError("expired");
  const accepted = await transaction.organizationInvitation.updateMany({
    where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
    data: { acceptedAt: now },
  });
  if (accepted.count !== 1) throw new OrganizationInvitationError("retry");
  const membershipRole = existingMembership?.active && (existingMembership.role === "OWNER" || existingMembership.role === "ADMIN")
    ? existingMembership.role : invitation.membershipRole;
  await transaction.organizationMembership.upsert({
    where: membershipKey,
    create: { organizationId: invitation.organizationId, providerId: input.providerId, role: membershipRole, active: true },
    update: { role: membershipRole, active: true },
  });
  return invitation;
}
