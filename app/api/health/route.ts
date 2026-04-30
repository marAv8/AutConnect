import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    nextAuthUrl: Boolean(process.env.NEXTAUTH_URL),
    nextAuthSecret: Boolean(process.env.NEXTAUTH_SECRET),
    googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
    appleOAuth: Boolean(process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET),
    database: "unknown" as "ok" | "error" | "unknown",
  };

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  return NextResponse.json(checks, {
    status: checks.database === "ok" ? 200 : 500,
  });
}
