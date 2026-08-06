import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isGoogleOAuthConfigured } from "@/lib/googleOAuth";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    googleOAuth: isGoogleOAuthConfigured(),
    sessionSigning: Boolean(
      process.env.AUTH_SESSION_SECRET?.trim() ||
        process.env.NEXTAUTH_SECRET?.trim()
    ),
    database: "unknown" as "ok" | "error" | "unknown",
    schema: "unknown" as "ok" | "error" | "unknown",
  };

  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  try {
    await db.provider.count();
    checks.schema = "ok";
  } catch {
    checks.schema = "error";
  }

  return NextResponse.json(checks, {
    status:
      checks.database === "ok" &&
      checks.schema === "ok" &&
      checks.sessionSigning
        ? 200
        : 500,
  });
}
