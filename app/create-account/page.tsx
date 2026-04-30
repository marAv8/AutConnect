// autconnect/app/create-account/page.tsx (this file is the create account page)

import { createProvider } from "@/app/actions/createProvider";
import OAuthButtons from "@/app/components/auth/OAuthButtons";
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
      : null;
  const googleEnabled = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
  );
  const appleEnabled = Boolean(
    process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET
  );

  return (
    <main className="auth-shell">
      <div className="auth-page">
        <header className="auth-header">
          <div className="auth-logo">AC</div>
        </header>

        <section className="auth-card auth-card-create">
          <div className="auth-form-wrap">
            <div className="auth-heading">
         
              <h2>Welcome to AutConnect</h2>
            </div>

            {errorMessage && <p className="auth-error">{errorMessage}</p>}

            <OAuthButtons
              mode="signup"
              googleEnabled={googleEnabled}
              appleEnabled={appleEnabled}
            />

            <div className="auth-separator">or</div>

            <form action={createProvider} className="auth-form">
              <div className="auth-form-columns">
                <div className="auth-form-column">
                  <div className="auth-field">
                    <label htmlFor="firstName">Name</label>
                    <input id="firstName" name="firstName" required />
                  </div>

                  <div className="auth-field">
                    <label htmlFor="lastName">Lastname</label>
                    <input id="lastName" name="lastName" required />
                  </div>

                  <div className="auth-field">
                    <label htmlFor="email">Email</label>
                    <input id="email" name="email" type="email" required />
                  </div>

                  <div className="auth-field">
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      name="password"
                      type="password"
                      required
                    />
                  </div>
                </div>

                <div className="auth-form-column">
                  <div className="auth-field">
                    <label htmlFor="role">Provider</label>
                    <select id="role" name="role" required>
                      <option value="">Select</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="SpeechPathologist">Speech Pathologist</option>
                      <option value="BehaviorTherapist">Behavior Therapist</option>
                      <option value="OccupationalTherapist">
                        Occupational Therapist
                      </option>
                      <option value="Caregiver">Caretaker</option>
                      <option value="Educator">Educator</option>
                    </select>
                  </div>

                  <button type="submit" className="auth-button">
                    Create Account
                  </button>
                </div>
              </div>
            </form>

            <div className="auth-link-row">
              <Link href="/login">Login to Account</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
