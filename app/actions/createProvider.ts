"use server";

import { createProviderSchema } from "@/app/libs/schemas/provider";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { setSession } from "@/lib/session";
import { invitationAuthPath } from "@/lib/organizationInvitationState";
import {
  acceptOrganizationInvitation,
  getAvailableOrganizationInvitation,
  normalizeInvitationEmail,
} from "@/lib/organizationInvitations";

export async function createProvider(formData: FormData): Promise<void> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    role: formData.get("role"),
  };
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();

  const parsed = createProviderSchema.safeParse(raw);

  if (!parsed.success) {
    redirect(invitationAuthPath("/create-account", inviteToken, "invalid"));
  }

  const { password, firstName, lastName } = parsed.data;
  const email = parsed.data.email.toLowerCase();
  const invitation = inviteToken
    ? await getAvailableOrganizationInvitation(inviteToken)
    : null;

  if (
    inviteToken &&
    (!invitation || invitation.normalizedEmail !== normalizeInvitationEmail(email))
  ) {
    redirect(invitationAuthPath("/create-account", inviteToken, "invalid-invite"));
  }

  if (!invitation && parsed.data.role === "Supervisor") {
    redirect(invitationAuthPath("/create-account", inviteToken, "supervisor-invite-required"));
  }

  const role = invitation?.providerRole ?? parsed.data.role;

  const existing = await db.provider.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      passwordHash: true,
    },
  });

  if (existing) {
    redirect(invitationAuthPath("/create-account", inviteToken, "email-exists"));
  }

  const passwordHash = await bcrypt.hash(password, 12);

  let provider: { id: string; role: string };
  try {
    provider = await db.$transaction(async (transaction) => {
      const created = await transaction.provider.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          role,
          providerRole: role,
          authType: "email",
        },
        select: {
          id: true,
          role: true,
        },
      });

      if (inviteToken) {
        await acceptOrganizationInvitation(transaction, {
          token: inviteToken,
          email,
          providerId: created.id,
          currentRole: role,
        });
      }

      return created;
    });
  } catch {
    redirect(
      invitationAuthPath("/create-account", inviteToken,
        inviteToken ? "invalid-invite" : "email-exists")
    );
  }

  await setSession({
    providerId: provider.id,
    role: provider.role,
  });

  redirect(inviteToken ? "/portal/organization/invitations?joined=1" : "/dashboard");
}
