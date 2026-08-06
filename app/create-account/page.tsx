// autconnect/app/create-account/page.tsx (this file is the create account page)

import { createProvider } from "@/app/actions/createProvider";
import AuthHeader from "@/app/components/auth/AuthHeader";
import OAuthButtons from "@/app/components/auth/OAuthButtons";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import { isGoogleOAuthConfigured } from "@/lib/googleOAuth";
import Link from "next/link";

export default async function createAccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>;
}) {
  const { error } = (await searchParams) ?? {};
  const errorMessage =
    error === "email-exists"
      ? "That email already exists. Try logging in or use another email."
      : error === "invalid"
        ? "Please check every field. Passwords must contain at least 8 characters."
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
              <div className="auth-form-columns">
                <div className="auth-form-column">
                  <div className="auth-field">
                    <label htmlFor="firstName">Name</label>
                    <input
                      id="firstName"
                      name="firstName"
                      autoComplete="given-name"
                      required
                    />
                  </div>

                  <div className="auth-field">
                    <label htmlFor="lastName">Lastname</label>
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
                </div>

                <div className="auth-form-column">
                  <div className="auth-field">
                    <label htmlFor="role">Provider</label>
                    <MaterialSelect
                      id="role"
                      name="role"
                      required
                      style={{ width: "100%" }}
                      options={[
                        { value: "", label: "Select" },
                        { value: "Supervisor", label: "Supervisor" },
                        { value: "SpeechPathologist", label: "Speech Pathologist" },
                        { value: "BehaviorTherapist", label: "Behavior Therapist" },
                        { value: "OccupationalTherapist", label: "Occupational Therapist" },
                        { value: "Caregiver", label: "Caretaker" },
                        { value: "Educator", label: "Educator" },
                      ]}
                    />
                  </div>

                  <button type="submit" className="auth-button">
                    Create Account
                  </button>
                </div>
              </div>
            </form>

            {googleEnabled && <div className="auth-separator">or</div>}

            <OAuthButtons
              mode="signup"
              googleEnabled={googleEnabled}
            />

            <div className="auth-link-row">
              <Link href="/login">Login to Account</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
