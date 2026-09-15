"use server";

import { providerRoleEnum } from "@/app/libs/schemas/provider";
import { getManagedOrganizationIds, requireCurrentProvider } from "@/lib/authorization";
import { db } from "@/lib/db";
import { invitationMembershipRole } from "@/lib/invitationPolicy";
import { acceptOrganizationInvitation, createInvitationToken, hashInvitationToken, normalizeInvitationEmail, ORGANIZATION_INVITATION_LIFETIME_DAYS } from "@/lib/organizationInvitations";
import { OrganizationInvitationError, invitationFailureMessage, invitationTokenFromLink, invitationLinkError } from "@/lib/organizationInvitationState";
import { revalidatePath } from "next/cache";
import { z } from "zod";

export type OrganizationInvitationState = {
  status: "idle" | "success" | "error";
  message?: string;
  invitationPath?: string;
  recipient?: { email: string; organizationId: string; providerRole: string };
};
const fail = (message: string): OrganizationInvitationState => ({ status: "error", message });
const schema = z.object({ organizationId: z.string().uuid(), email: z.string().trim().email(), providerRole: providerRoleEnum });
function refreshInvitations() {
  revalidatePath("/portal/supervisor/invitations");
  revalidatePath("/portal/organization/invitations");
  revalidatePath("/dashboard");
}
function failure(error: unknown) {
  // Do not log errors that may embed submitted secrets or database parameters.
  return fail(error instanceof OrganizationInvitationError ? invitationFailureMessage(error.code) : invitationFailureMessage("retry"));
}

export async function createOrganizationInvitation(_previous: OrganizationInvitationState, form: FormData): Promise<OrganizationInvitationState> {
  try {
    const actor = await requireCurrentProvider();
    const parsed = schema.safeParse({ organizationId: form.get("organizationId"), email: form.get("email"), providerRole: form.get("providerRole") });
    if (!parsed.success) return fail("Check the organization, email and role.");
    const { organizationId, email, providerRole } = parsed.data;
    if (!(await getManagedOrganizationIds(actor.id)).includes(organizationId)) return fail("Only this organization’s active owners and administrators can invite staff.");
    const normalizedEmail = normalizeInvitationEmail(email);
    const token = createInvitationToken();
    await db.$transaction(async tx => {
      if (!(await getManagedOrganizationIds(actor.id, tx)).includes(organizationId)) throw new OrganizationInvitationError("unavailable");
      const existing = await tx.provider.findFirst({ where: { email: { equals: normalizedEmail, mode: "insensitive" } }, select: { role: true, status: true } });
      if (existing && (existing.role !== providerRole || existing.status !== "ACTIVE")) throw new OrganizationInvitationError(existing.status !== "ACTIVE" ? "inactive-account" : "role-mismatch");
      const previous = await tx.organizationInvitation.findFirst({ where: { organizationId, normalizedEmail, acceptedAt: null, revokedAt: null }, select: { id: true } });
      if (previous && form.get("replaceConfirmed") !== "yes") throw new OrganizationInvitationError("confirm-replacement");
      const now = new Date();
      await tx.organizationInvitation.updateMany({ where: { organizationId, normalizedEmail, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } });
      await tx.organizationInvitation.create({ data: { organizationId, email, normalizedEmail, providerRole, membershipRole: invitationMembershipRole(providerRole), tokenHash: hashInvitationToken(token), expiresAt: new Date(now.getTime() + ORGANIZATION_INVITATION_LIFETIME_DAYS * 86400000), invitedByProviderId: actor.id } });
    }, { isolationLevel: "Serializable" });
    refreshInvitations();
    return { status: "success", message: "Invitation created. Copy and share this link directly; no email was sent. It expires in 7 days.", invitationPath: `/create-account?invite=${encodeURIComponent(token)}`, recipient: { email, organizationId, providerRole } };
  } catch (error) { return failure(error); }
}

export async function manageOrganizationInvitation(_previous: OrganizationInvitationState, form: FormData): Promise<OrganizationInvitationState> {
  try {
    const actor = await requireCurrentProvider();
    const id = String(form.get("invitationId") ?? "");
    const action = form.get("decision");
    if (!id || !["reissue", "revoke", "correct"].includes(String(action))) return fail("Choose an available invitation action.");
    const correctedEmail = action === "correct" ? z.string().trim().email().safeParse(form.get("correctedEmail")) : null;
    if (action === "correct" && !correctedEmail?.success) return fail("Enter the corrected recipient email.");
    if (action === "correct" && form.get("correctionConfirmed") !== "yes") return fail("Confirm the recipient correction. The incorrect link and any previous unused link for the corrected address will stop working.");
    const token = action !== "revoke" ? createInvitationToken() : null;
    let recipient: OrganizationInvitationState["recipient"];
    await db.$transaction(async tx => {
      const organizationIds = await getManagedOrganizationIds(actor.id, tx);
      const invitation = await tx.organizationInvitation.findFirst({ where: { id, organizationId: { in: organizationIds } } });
      if (!invitation) throw new OrganizationInvitationError("unavailable");
      if (invitation.acceptedAt) throw new OrganizationInvitationError("already-accepted");
      if (action !== "revoke" && invitation.membershipRole === "OWNER") throw new OrganizationInvitationError("owner-invitation");
      if (action === "reissue" && form.get("replaceConfirmed") !== "yes") throw new OrganizationInvitationError("confirm-replacement");
      const now = new Date();
      if (action === "revoke") {
        await tx.organizationInvitation.updateMany({ where: { id, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } });
      } else {
        const email = correctedEmail?.success ? correctedEmail.data : invitation.email;
        const normalizedEmail = normalizeInvitationEmail(email);
        if (action === "correct" && normalizedEmail === invitation.normalizedEmail) throw new OrganizationInvitationError("recipient-unchanged");
        const existing = await tx.provider.findFirst({ where: { email: { equals: normalizedEmail, mode: "insensitive" } }, select: { role: true, status: true } });
        if (existing && (existing.role !== invitation.providerRole || existing.status !== "ACTIVE")) throw new OrganizationInvitationError(existing.status !== "ACTIVE" ? "inactive-account" : "role-mismatch");
        await tx.organizationInvitation.updateMany({ where: { organizationId: invitation.organizationId, normalizedEmail: invitation.normalizedEmail, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } });
        if (action === "correct") await tx.organizationInvitation.updateMany({ where: { organizationId: invitation.organizationId, normalizedEmail, acceptedAt: null, revokedAt: null }, data: { revokedAt: now } });
        await tx.organizationInvitation.create({ data: {
          organizationId: invitation.organizationId, email, normalizedEmail,
          providerRole: invitation.providerRole, membershipRole: invitation.membershipRole,
          invitedByProviderId: actor.id, tokenHash: hashInvitationToken(token!), expiresAt: new Date(now.getTime() + ORGANIZATION_INVITATION_LIFETIME_DAYS * 86400000),
        } });
        recipient = { email, organizationId: invitation.organizationId, providerRole: invitation.providerRole };
      }
    }, { isolationLevel: "Serializable" });
    refreshInvitations();
    return { status: "success", message: token ? `${action === "correct" ? "Recipient corrected. The incorrect invitation was revoked." : "Replacement ready."} Previous unused links no longer work. Copy this link; no email was sent.` : "Invitation revoked. Existing memberships and Client assignments were not changed.", ...(token ? { invitationPath: `/create-account?invite=${encodeURIComponent(token)}`, recipient } : {}) };
  } catch (error) { return failure(error); }
}

export async function decideOrganizationInvitation(_previous: OrganizationInvitationState, form: FormData): Promise<OrganizationInvitationState> {
  try {
    const actor = await requireCurrentProvider();
    const account = await db.provider.findUniqueOrThrow({ where: { id: actor.id }, select: { email: true } });
    const link = String(form.get("invitationLink") ?? "").trim();
    const linkError = invitationLinkError(link);
    if (linkError) return fail(linkError);
    const token = invitationTokenFromLink(link);
    const id = String(form.get("invitationId") ?? "");
    const decision = form.get("decision");
    if (decision !== "accept" && decision !== "decline") return fail("Choose Accept or Decline.");
    const invitation = await db.$transaction(async tx => {
      const target = await tx.organizationInvitation.findUnique({ where: { tokenHash: hashInvitationToken(token) }, select: { id: true, normalizedEmail: true, acceptedAt: true, revokedAt: true, expiresAt: true, organization: { select: { name: true } } } });
      if (!target || target.normalizedEmail !== normalizeInvitationEmail(account.email)) throw new OrganizationInvitationError("wrong-account");
      // Classify the recipient's older link before checking the selected card ID.
      // Otherwise a replaced link pasted into the current card looks like a wrong account.
      if (!target.acceptedAt && target.revokedAt) throw new OrganizationInvitationError("revoked");
      if (!target.acceptedAt && target.expiresAt <= new Date()) throw new OrganizationInvitationError("expired");
      if (target.id !== id) throw new OrganizationInvitationError("unavailable");
      if (decision === "accept") return acceptOrganizationInvitation(tx, { token, email: account.email, providerId: actor.id, currentRole: actor.role });
      if (target.acceptedAt) throw new OrganizationInvitationError("already-accepted");
      if (target.revokedAt) throw new OrganizationInvitationError("revoked");
      if (target.expiresAt <= new Date()) throw new OrganizationInvitationError("expired");
      const changed = await tx.organizationInvitation.updateMany({ where: { id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, data: { revokedAt: new Date() } });
      if (changed.count !== 1) throw new OrganizationInvitationError("retry");
      return target;
    }, { isolationLevel: "Serializable" });
    refreshInvitations();
    return { status: "success", message: decision === "accept" ? `You’ve joined ${invitation.organization.name}. Your Client assignments are managed separately.` : "Invitation declined. This link can no longer grant membership." };
  } catch (error) { return failure(error); }
}
