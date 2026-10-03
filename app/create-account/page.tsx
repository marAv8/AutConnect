// autconnect/app/create-account/page.tsx (this file is the create account page)

import { createProvider } from "@/app/actions/createProvider";
import AuthHeader from "@/app/components/auth/AuthHeader";
import OAuthButtons from "@/app/components/auth/OAuthButtons";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import { isGoogleOAuthConfigured } from "@/lib/googleOAuth";
import {
  getAvailableOrganizationInvitation,
} from "@/lib/organizationInvitations";
import Link from "next/link";

export default async function createAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; invite?: string }>;
}) {
  const { error, invite } = (await searchParams) ?? {};
  const invitation = invite
    ? await getAvailableOrganizationInvitation(invite)
    : null;
  const errorMessage =
    error === "email-exists"
      ? "That email already exists. Try logging in or use another email."
      : error === "invalid"
        ? "Please check every field. Passwords must contain at least 8 characters."
        : error === "invalid-invite" || (invite && !invitation)
          ? "This invitation is invalid, expired, or has already been used."
          : error === "supervisor-invite-required"
            ? "Supervisor accounts require an agency invitation."
      : null;
  const googleEnabled = isGoogleOAuthConfigured();

  return (
    <main className="auth-shell">
      <AuthHeader wordmark />
      <div className="auth-page">
        <section className="auth-card auth-card-create">
          <div className="auth-form-wrap">
            {errorMessage && <p className="auth-error">{errorMessage}</p>}

            <form action={createProvider} className="auth-form">
              {invitation && invite ? (
                <>
                  <input type="hidden" name="inviteToken" value={invite} />
                  <input type="hidden" name="role" value={invitation.providerRole} />
                  <p className="form-helper-text">
                    Invitation to {invitation.organization.name} as {roleLabel(invitation.providerRole)}.
                  </p>
                </>
              ) : null}
              <div className="auth-form-columns auth-account-fields">
                <div className="auth-field">
                  <label htmlFor="firstName">First name</label>
                  <input
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="lastName">Last name</label>
                  <input
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    defaultValue={invitation?.email ?? ""}
                    readOnly={Boolean(invitation)}
                    required
                  />
                </div>

                <div className="auth-field">
                  <label htmlFor="password">Password</label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    required
                  />
                </div>
                {invitation ? (
                  <div className="auth-field auth-field-wide auth-provider-field">
                    <label>Provider</label>
                    <input value={roleLabel(invitation.providerRole)} readOnly />
                  </div>
                ) : (
                  <div className="auth-field auth-field-wide auth-provider-field">
                    <label htmlFor="role">Provider</label>
                    <MaterialSelect
                      id="role"
                      name="role"
                      required
                      style={{ width: "100%" }}
                      options={[
                        { value: "", label: "Select" },
                        { value: "SpeechPathologist", label: "Speech Pathologist" },
                        { value: "BehaviorTherapist", label: "Behavior Therapist" },
                        { value: "OccupationalTherapist", label: "Occupational Therapist" },
                        { value: "Caregiver", label: "Caretaker" },
                        { value: "Educator", label: "Educator" },
                      ]}
                    />
                  </div>
                )}
              </div>
              <button type="submit" className="auth-button auth-form-submit">
                Create Account
              </button>
            </form>

            {googleEnabled && <div className="auth-separator">or</div>}

            <OAuthButtons
              mode="signup"
              googleEnabled={googleEnabled}
              inviteToken={invitation && invite ? invite : undefined}
            />

            <div className="auth-link-row">
              <Link href={invite ? `/login?invite=${encodeURIComponent(invite)}` : "/login"}>
                Login to Account
              </Link>
            </div>
            {!invitation ? (
              <div className="auth-link-row">
                <Link href="/request-agency-access">Register an agency or school</Link>
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}

function roleLabel(role: string) {
  const labels: Record<string, string> = {
    Supervisor: "Supervisor",
    SpeechPathologist: "Speech Pathologist",
    BehaviorTherapist: "Behavior Therapist",
    OccupationalTherapist: "Occupational Therapist",
    Caregiver: "Caretaker",
    Educator: "Educator",
  };
  return labels[role] ?? role;
}
