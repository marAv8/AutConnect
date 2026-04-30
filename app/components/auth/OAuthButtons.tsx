"use client";

import { signIn } from "next-auth/react";

type Props = {
  mode: "login" | "signup";
  googleEnabled: boolean;
  appleEnabled: boolean;
};

export default function OAuthButtons({ mode, googleEnabled, appleEnabled }: Props) {
  const googleLabel = mode === "login" ? "Continue with Google" : "Sign up with Google";
  const appleLabel = mode === "login" ? "Continue with Apple" : "Sign up with Apple";

  return (
    <div className="auth-oauth-stack">
      <button
        type="button"
        className="auth-button"
        disabled={!googleEnabled}
        onClick={() => signIn("google", { callbackUrl: "/auth/oauth-complete" })}
      >
        {googleLabel}
      </button>
      <button
        type="button"
        className="auth-button"
        disabled={!appleEnabled}
        onClick={() => signIn("apple", { callbackUrl: "/auth/oauth-complete" })}
      >
        {appleLabel}
      </button>
    </div>
  );
}
