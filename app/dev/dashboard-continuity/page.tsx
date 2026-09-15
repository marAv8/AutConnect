import { notFound } from "next/navigation";
import DashboardContinuityHarness from "./DashboardContinuityHarness";
import DashboardShell from "@/app/dashboard/DashboardShell";

export default async function DashboardContinuityPage({ searchParams }: {
  searchParams: Promise<{ owners?: string; role?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  return <DashboardShell><DashboardContinuityHarness initialOwners={query.owners === "1"} initialProvider={query.role === "provider"} /></DashboardShell>;
}
