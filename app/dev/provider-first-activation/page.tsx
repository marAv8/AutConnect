import FirstActivationDiagnostic from "@/app/dashboard/FirstActivationDiagnostic";
import { notFound } from "next/navigation";
import AuthenticatedPageHeader from "@/app/components/AuthenticatedPageHeader";
import AuthenticatedViewportStabilizer from "@/app/components/AuthenticatedViewportStabilizer";
import DashboardContinuityHarness from "../dashboard-continuity/DashboardContinuityHarness";

export default async function ProviderFirstActivationPage({ searchParams }: {
  searchParams: Promise<{ role?: string; orbit?: string; debugFirstActivation?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const provider = query.role !== "supervisor";
  return <><div className="dashboard-shared-shell">
    <AuthenticatedViewportStabilizer />
    <div className="dashboard-shell-header-region app-shell-pad">
      <AuthenticatedPageHeader displayName="Synthetic Account" role={provider ? "OccupationalTherapist" : "Supervisor"} />
    </div>
    <div className="dashboard-shell-body">
      <main className="dashboard-page-shell"><section className="dashboard-page-content">
        {query.debugFirstActivation === "1" ? <FirstActivationDiagnostic /> : null}
        <DashboardContinuityHarness initialOwners initialProvider={provider} occupational={provider} initialOrbit={query.orbit === "1"} />
      </section></main>
    </div>
  </div></>;
}
