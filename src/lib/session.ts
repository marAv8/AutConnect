import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "autconnect_session";

export type SessionData = {
  providerId: string;
  role: string;
};

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, JSON.stringify(data), sessionCookieOptions());
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function setSessionOnResponse(
  response: NextResponse,
  data: SessionData
): NextResponse {
  response.cookies.set(SESSION_COOKIE, JSON.stringify(data), sessionCookieOptions());
  return response;
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
