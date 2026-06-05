import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks = {
    databaseUrl: Boolean(process.env.DATABASE_URL),
    googleOAuth: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
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
    status: checks.database === "ok" && checks.schema === "ok" ? 200 : 500,
  });
}
