"use server";

import { requireCurrentPlatformAdmin } from "@/lib/authorization";
import { db } from "@/lib/db";
import {
  createInvitationToken,
  hashInvitationToken,
  normalizeInvitationEmail,
  ORGANIZATION_INVITATION_LIFETIME_DAYS,
} from "@/lib/organizationInvitations";
import { z } from "zod";

export type AgencyRequestState = {
  status: "idle" | "success" | "error";
  message?: string;
};

export type AgencyApprovalState = AgencyRequestState & {
  invitationPath?: string;
};

const requestSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  organizationType: z.enum(["AGENCY", "SCHOOL", "DISTRICT"]),
  contactFirstName: z.string().trim().min(1).max(80),
  contactLastName: z.string().trim().min(1).max(80),
  contactEmail: z.string().trim().email().max(254),
});

const approvalSchema = z.object({ requestId: z.string().uuid() });

function normalizeOrganizationName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export async function submitAgencyAccessRequest(
  _previousState: AgencyRequestState,
  formData: FormData
): Promise<AgencyRequestState> {
  // A filled honeypot is treated as accepted so automated submissions learn nothing.
  if (formData.get("website")) {
    return {
      status: "success",
      message: "Your request was received for review.",
    };
  }

  const parsed = requestSchema.safeParse({
    organizationName: formData.get("organizationName"),
    organizationType: formData.get("organizationType"),
    contactFirstName: formData.get("contactFirstName"),
    contactLastName: formData.get("contactLastName"),
    contactEmail: formData.get("contactEmail"),
  });

  if (!parsed.success) {
    return { status: "error", message: "Please check every field." };
  }

  const normalizedOrganization = normalizeOrganizationName(
    parsed.data.organizationName
  );
  const normalizedEmail = normalizeInvitationEmail(parsed.data.contactEmail);
  const [existingOrganization, pendingRequest] = await Promise.all([
    db.organization.findUnique({
      where: { normalizedName: normalizedOrganization },
      select: { id: true },
    }),
    db.agencyAccessRequest.findFirst({
      where: {
        normalizedOrganization,
        normalizedEmail,
        status: "PENDING",
      },
      select: { id: true },
    }),
  ]);

  if (!existingOrganization && !pendingRequest) {
    await db.agencyAccessRequest.create({
      data: {
        organizationName: parsed.data.organizationName.replace(/\s+/g, " "),
        normalizedOrganization,
        organizationType: parsed.data.organizationType,
        contactFirstName: parsed.data.contactFirstName,
        contactLastName: parsed.data.contactLastName,
        contactEmail: parsed.data.contactEmail,
        normalizedEmail,
      },
    });
  }

  return {
    status: "success",
    message:
      "Your request was received for review. Access is not active until AutConnect approves the agency and sends an invitation.",
  };
}

export async function approveAgencyAccessRequest(
  _previousState: AgencyApprovalState,
  formData: FormData
): Promise<AgencyApprovalState> {
  const platformAdmin = await requireCurrentPlatformAdmin();
  const parsed = approvalSchema.safeParse({ requestId: formData.get("requestId") });
  if (!parsed.success) {
    return { status: "error", message: "That request is invalid." };
  }

  const request = await db.agencyAccessRequest.findUnique({
    where: { id: parsed.data.requestId },
  });
  if (!request || request.status !== "PENDING") {
    return { status: "error", message: "That request is no longer pending." };
  }

  const token = createInvitationToken();
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + ORGANIZATION_INVITATION_LIFETIME_DAYS * 24 * 60 * 60 * 1000
  );

  try {
    await db.$transaction(async (transaction) => {
      const stillPending = await transaction.agencyAccessRequest.findFirst({
        where: { id: request.id, status: "PENDING" },
        select: { id: true },
      });
      if (!stillPending) throw new Error("REQUEST_ALREADY_REVIEWED");

      const organization = await transaction.organization.create({
        data: {
          name: request.organizationName,
          normalizedName: request.normalizedOrganization,
          type: request.organizationType,
        },
        select: { id: true },
      });

      await transaction.organizationInvitation.create({
        data: {
          organizationId: organization.id,
          email: request.contactEmail,
          normalizedEmail: request.normalizedEmail,
          providerRole: "Supervisor",
          membershipRole: "OWNER",
          tokenHash: hashInvitationToken(token),
          expiresAt,
          invitedByProviderId: platformAdmin.id,
        },
      });

      await transaction.agencyAccessRequest.update({
        where: { id: request.id },
        data: {
          status: "APPROVED",
          reviewedAt: now,
          reviewedByProviderId: platformAdmin.id,
          approvedOrganizationId: organization.id,
        },
      });
    });
  } catch (error) {
    console.error("Agency approval failed", error);
    return {
      status: "error",
      message:
        "The agency could not be approved. It may already exist or have been reviewed.",
    };
  }

  return {
    status: "success",
    message: `Agency approved. The owner invitation expires in ${ORGANIZATION_INVITATION_LIFETIME_DAYS} days.`,
    invitationPath: `/create-account?invite=${encodeURIComponent(token)}`,
  };
}
