"use server";

import { firstActivationLoginDestination } from "@/app/dashboard/firstActivationFlag";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { setSession } from "@/lib/session";
import { OrganizationInvitationError } from "@/lib/organizationInvitationState";
import { acceptOrganizationInvitation } from "@/lib/organizationInvitations";

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type LoginState = {
  error: string | null;
};

export async function loginProvider(
  prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };
  const inviteToken = String(formData.get("inviteToken") ?? "").trim();

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Invalid email or password format" };
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
  const provider = await db.provider.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      email: true,
      status: true,
      passwordHash: true,
      role: true,
      providerRole: true,
    },
  });

  if (!provider) {
    return { error: "Invalid credentials" };
  }

  if (!provider.passwordHash) {
    return { error: "Please use Google OAuth to log in" };
  }

  const isValid = await bcrypt.compare(password, provider.passwordHash);
  if (!isValid) {
    return { error: "Invalid credentials" };
  }

  if (provider.status !== "ACTIVE") return { error: "Your account is not active. Contact your administrator." };

  const sessionRole = provider.role || provider.providerRole;
  if (!sessionRole) {
    return { error: "Your account is not fully configured. Please contact support." };
  }

  if (inviteToken) {
    try {
      await db.$transaction(async (transaction) => {
        await acceptOrganizationInvitation(transaction, {
          token: inviteToken,
          email: provider.email,
          providerId: provider.id,
          currentRole: sessionRole,
        });
      });
    } catch (error) {
      // Credentials are valid: keep the user signed in with a visible invitation
      // recovery page instead of trapping them at Login or an empty Dashboard.
      await setSession({ providerId: provider.id, role: sessionRole });
      const issue = error instanceof OrganizationInvitationError ? error.code : "retry";
      redirect(`/portal/organization/invitations?issue=${issue}`);
    }
  }

  await setSession({
    providerId: provider.id,
    role: sessionRole,
  });

  redirect(inviteToken ? "/portal/organization/invitations?joined=1" : firstActivationLoginDestination(formData));
}
