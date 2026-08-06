import { db } from "@/lib/db";
import { getGoogleOAuthConfig } from "@/lib/googleOAuth";
import { setSessionOnResponse } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const OAUTH_STATE_COOKIE = "autconnect_oauth_state";

type GoogleTokenResponse = {
  access_token?: string;
  error?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
  name?: string;
};

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const loginUrl = googleErrorUrl(request);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectClearingState(loginUrl);
  }

  const config = getGoogleOAuthConfig();

  if (!config) {
    return redirectClearingState(loginUrl);
  }

  const redirectUri = new URL("/api/auth/callback/google", request.url).toString();
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return redirectClearingState(loginUrl);
  }

  const token = (await tokenResponse.json()) as GoogleTokenResponse;
  if (!token.access_token || token.error) {
    return redirectClearingState(loginUrl);
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${token.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    return redirectClearingState(loginUrl);
  }

  const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;
  const email = userInfo.email?.toLowerCase();

  if (!email || userInfo.email_verified !== true) {
    return redirectClearingState(loginUrl);
  }

  const provider = await upsertGoogleProvider(email, userInfo);
  const destination = provider.role ? "/dashboard" : "/complete-profile";
  const response = NextResponse.redirect(new URL(destination, request.url));

  response.cookies.delete(OAUTH_STATE_COOKIE);
  return setSessionOnResponse(response, {
    providerId: provider.id,
    role: provider.role,
  });
}

async function upsertGoogleProvider(email: string, userInfo: GoogleUserInfo) {
  const existing = await db.provider.findFirst({
    where: {
      email: {
        equals: email,
        mode: "insensitive",
      },
    },
    select: { id: true, role: true },
  });

  if (existing) {
    return db.provider.update({
      where: { id: existing.id },
      data: { email, authType: "google" },
      select: { id: true, role: true },
    });
  }

  const { firstName, lastName } = nameParts(userInfo);

  return db.provider.create({
    data: {
      email,
      firstName,
      lastName,
      role: "",
      providerRole: null,
      passwordHash: "",
      authType: "google",
    },
    select: { id: true, role: true },
  });
}

function nameParts(userInfo: GoogleUserInfo) {
  const fromProfile = {
    firstName: userInfo.given_name?.trim() ?? "",
    lastName: userInfo.family_name?.trim() ?? "",
  };

  if (fromProfile.firstName || fromProfile.lastName) {
    return fromProfile;
  }

  const parts = (userInfo.name ?? "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function redirectClearingState(url: URL) {
  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

function googleErrorUrl(request: NextRequest) {
  return new URL("/login?error=google-auth", request.url);
}
