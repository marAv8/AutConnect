"use server";

import { redirect } from "next/navigation";
import { clearSession } from "@/lib/session";

export async function logoutProvider(): Promise<never> {
  await clearSession();
  redirect("/login");
}
