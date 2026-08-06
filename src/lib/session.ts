import type { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "autconnect_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

export type SessionData = {
  providerId: string;
  role: string;
};

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, encodeSession(data), sessionCookieOptions());
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE)?.value;
  if (!raw) return null;

  return decodeSession(raw);
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export function setSessionOnResponse(
  response: NextResponse,
  data: SessionData
): NextResponse {
  response.cookies.set(SESSION_COOKIE, encodeSession(data), sessionCookieOptions());
  return response;
}

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  };
}

type SessionPayload = SessionData & {
  expiresAt: number;
};

function encodeSession(data: SessionData): string {
  const payload: SessionPayload = {
    ...data,
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function decodeSession(value: string): SessionData | null {
  const [encodedPayload, signature, extra] = value.split(".");
  if (!encodedPayload || !signature || extra) {
    return null;
  }

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");

  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as Partial<SessionPayload>;

    if (
      typeof payload.providerId !== "string" ||
      !payload.providerId ||
      typeof payload.role !== "string" ||
      !payload.role ||
      typeof payload.expiresAt !== "number" ||
      payload.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      return null;
    }

    return {
      providerId: payload.providerId,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

function sign(payload: string): string {
  const secret =
    process.env.AUTH_SESSION_SECRET?.trim() ??
    process.env.NEXTAUTH_SECRET?.trim();

  if (!secret) {
    throw new Error(
      "AUTH_SESSION_SECRET or NEXTAUTH_SECRET is required for authentication"
    );
  }

  return createHmac("sha256", secret).update(payload).digest("base64url");
}
