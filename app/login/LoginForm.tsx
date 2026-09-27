"use client";

import { loginProvider } from "@/app/actions/loginProvider";
import OAuthButtons from "@/app/components/auth/OAuthButtons";
import Link from "next/link";
import { useActionState } from "react";

type Props = {
  googleEnabled: boolean;
  oauthError: string | null;
  inviteToken?: string;
  debugFirstActivation?: boolean;
};

export default function LoginForm({ googleEnabled, oauthError, inviteToken, debugFirstActivation = false }: Props) {
  const [state, formAction, isPending] = useActionState(loginProvider, {
    error: null,
  });

  return (
    <section className="auth-card auth-card-login">
      <div className="auth-form-wrap">
        {oauthError && <p className="auth-error">{oauthError}</p>}

        <form action={formAction} className="auth-form">
          {debugFirstActivation ? <input type="hidden" name="debugFirstActivation" value="1" /> : null}
          {inviteToken ? (
            <input type="hidden" name="inviteToken" value={inviteToken} />
          ) : null}
          {state.error && <p className="auth-error">{state.error}</p>}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="auth-button" disabled={isPending}>
            {isPending ? "Logging in..." : "Login"}
          </button>
        </form>

        {googleEnabled && <div className="auth-separator">or</div>}

        <OAuthButtons
          mode="login"
          googleEnabled={googleEnabled}
          inviteToken={inviteToken}
        />

        <div className="auth-link-row">
          Need an account?{
            " "
          }<Link href={inviteToken ? `/create-account?invite=${encodeURIComponent(inviteToken)}` : "/create-account"}>
            Create Account
          </Link>
        </div>
      </div>
    </section>
  );
}
