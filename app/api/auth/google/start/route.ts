import { NextResponse } from "next/server";
import { getGoogleOAuthConfig } from "@/lib/googleOAuth";
import { getAvailableOrganizationInvitation } from "@/lib/organizationInvitations";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const OAUTH_STATE_COOKIE = "autconnect_oauth_state";
const OAUTH_INVITE_COOKIE = "autconnect_oauth_invite";

export async function GET(request: Request) {
  const inviteToken = new URL(request.url).searchParams.get("invite")?.trim() ?? "";
  if (inviteToken && !(await getAvailableOrganizationInvitation(inviteToken))) {
    return NextResponse.redirect(
      new URL("/create-account?error=invalid-invite", request.url)
    );
  }

  const config = getGoogleOAuthConfig();

  if (!config) {
    return NextResponse.redirect(
      new URL("/login?error=google-unavailable", request.url)
    );
  }

  const state = crypto.randomUUID();
  const redirectUri = new URL("/api/auth/callback/google", request.url).toString();
  const googleUrl = new URL(GOOGLE_AUTH_URL);

  googleUrl.searchParams.set("client_id", config.clientId);
  googleUrl.searchParams.set("redirect_uri", redirectUri);
  googleUrl.searchParams.set("response_type", "code");
  googleUrl.searchParams.set("scope", "openid email profile");
  googleUrl.searchParams.set("state", state);
  googleUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(googleUrl);
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });
  if (inviteToken) {
    response.cookies.set(OAUTH_INVITE_COOKIE, inviteToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 10 * 60,
    });
  } else {
    response.cookies.delete(OAUTH_INVITE_COOKIE);
  }

  return response;
}
