import { notFound } from "next/navigation";
import DashboardContinuityHarness from "./DashboardContinuityHarness";
import DashboardShell from "@/app/dashboard/DashboardShell";
import AuthenticatedPageHeader from "@/app/components/AuthenticatedPageHeader";
import AuthenticatedViewportStabilizer from "@/app/components/AuthenticatedViewportStabilizer";

export default async function DashboardContinuityPage({ searchParams }: {
  searchParams: Promise<{ owners?: string; role?: string; orbit?: string; viewport?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  if (query.viewport === "1") return <div className="dashboard-shared-shell">
    <AuthenticatedViewportStabilizer />
    <div className="dashboard-shell-header-region app-shell-pad">
      <AuthenticatedPageHeader displayName="Synthetic Supervisor" role="Supervisor" />
    </div>
    <div className="dashboard-shell-body"><DashboardContinuityHarness initialOwners initialOrbit={query.orbit === "1"} /></div>
  </div>;
  return <DashboardShell><DashboardContinuityHarness initialOwners={query.owners === "1"} initialProvider={query.role === "provider" || query.role === "occupational"} occupational={query.role === "occupational"} initialOrbit={query.orbit === "1"} /></DashboardShell>;
}
