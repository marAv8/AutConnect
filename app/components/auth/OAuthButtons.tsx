"use client";

type Props = {
  mode: "login" | "signup";
  googleEnabled: boolean;
};

export default function OAuthButtons({ mode, googleEnabled }: Props) {
  const googleLabel = mode === "login" ? "Continue with Google" : "Sign up with Google";

  return (
    <div className="auth-oauth-stack">
      <button
        type="button"
        className="auth-button"
        disabled={!googleEnabled}
        onClick={() => {
          window.location.assign("/api/auth/google/start");
        }}
      >
        {googleLabel}
      </button>
    </div>
  );
}
