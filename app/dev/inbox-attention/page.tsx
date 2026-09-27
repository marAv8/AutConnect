import { notFound } from "next/navigation";
import DashboardInboxControl from "@/app/dashboard/DashboardInboxControl";
import DashboardWorkspaceLayout from "@/app/dashboard/DashboardWorkspaceLayout";
import ThemeToggle from "@/app/components/ThemeToggle";

// Synthetic aggregate props only. Never available in deployed builds.
export default async function InboxAttentionFixture({ searchParams }: {
  searchParams: Promise<{ category?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const { category = "all" } = await searchParams;
  const count = (key: string, value: number) => category === "all" || category === key ? value : 0;
  return <div className="dashboard-shared-shell"><div className="dashboard-shell-body">
    <DashboardWorkspaceLayout topNav={null} content={<h1>Inbox fixture</h1>}
      floatingMenu={<div className="dashboard-utility-controls">
        <DashboardInboxControl canAccessCaseSupport canReviewOrganizationInvitations
          caseSupportCount={count("case", 2)} organizationInvitationCount={count("client-organization", 3)}
          attentionCounts={{ organizationAccessRequests: count("platform", 4), myOrganizationInvitations: count("recipient", 5), clientParticipationRequests: count("manager", 6) }} />
        <ThemeToggle />
      </div>} />
  </div></div>;
}
