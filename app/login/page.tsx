import AuthHeader from "@/app/components/auth/AuthHeader";
import LoginForm from "@/app/login/LoginForm";
import { isGoogleOAuthConfigured } from "@/lib/googleOAuth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; invite?: string; debugFirstActivation?: string | string[] }>;
}) {
  const { error, invite, debugFirstActivation } = (await searchParams) ?? {};
  const oauthError =
    error === "google-unavailable"
      ? "Google login is temporarily unavailable."
      : error === "google-auth"
        ? "Google login could not be completed. Please try again."
        : null;

  return (
    <main className="auth-shell">
      <AuthHeader wordmark />
      <div className="auth-page">
        <LoginForm
          googleEnabled={isGoogleOAuthConfigured()}
          oauthError={oauthError}
          inviteToken={invite}
          debugFirstActivation={debugFirstActivation === "1"}
        />
      </div>
    </main>
  );
}
