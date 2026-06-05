"use client";

import { loginProvider } from "@/app/actions/loginProvider";
import OAuthButtons from "@/app/components/auth/OAuthButtons";
import Link from "next/link";
import { useActionState } from "react";

export default function LoginPage() {
  const googleEnabled = Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
  );

  const [state, formAction, isPending] = useActionState(loginProvider, {
    error: null,
  });

  return (
    <main className="auth-shell">
      <div className="auth-page">
        <section className="auth-card auth-card-login">
          <div className="auth-form-wrap">
            <div className="auth-heading">
              <h2>AC</h2>
            </div>

            <OAuthButtons
              mode="login"
              googleEnabled={googleEnabled}
            />

            <div className="auth-separator">or</div>

            <form action={formAction} className="auth-form">
              {state.error && (
                <div style={{ color: "red", marginBottom: "10px", fontSize: "14px" }}>
                  {state.error}
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="email">Email</label>
                <input id="email" type="email" name="email" required />
              </div>

              <div className="auth-field">
                <label htmlFor="password">Password</label>
                <input id="password" type="password" name="password" required />
              </div>

              <button type="submit" className="auth-button" disabled={isPending}>
                {isPending ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="auth-link-row auth-link-row-blue">
              Need an account? <Link href="/create-account">Create Account</Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
