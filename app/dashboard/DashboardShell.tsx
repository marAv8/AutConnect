import AppUserHeader from "@/app/components/AppUserHeader";
import AuthenticatedViewportStabilizer from "@/app/components/AuthenticatedViewportStabilizer";
import DashboardInteractionTraceHydration from "./DashboardInteractionTraceHydration";

type Props = Readonly<{
  children: React.ReactNode;
}>;

export default function DashboardShell({ children }: Props) {
  return (
    <div className="dashboard-shared-shell">
      <DashboardInteractionTraceHydration />
      <AuthenticatedViewportStabilizer />
      <div className="dashboard-shell-header-region app-shell-pad">
        <AppUserHeader />
      </div>
      <div className="dashboard-shell-body">{children}</div>
    </div>
  );
}
