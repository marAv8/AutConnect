"use client";

type Props = {
  mode: "login" | "signup";
  googleEnabled: boolean;
};

export default function OAuthButtons({ mode, googleEnabled }: Props) {
  const googleLabel = mode === "login" ? "Continue with Google" : "Sign up with Google";

  if (!googleEnabled) {
    return null;
  }

  return (
    <div className="auth-oauth-stack">
      <button
        type="button"
        className="auth-button"
        onClick={() => {
          window.location.assign("/api/auth/google/start");
        }}
      >
        {googleLabel}
      </button>
    </div>
  );
}
