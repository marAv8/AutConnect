import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import SupervisorDashboard from "@/app/dashboard/SupervisorDashboard";
import { isPlatformAdminEmail } from "@/lib/platformAdminPolicy";
import { caseSupportNotificationAccessWhere } from "@/app/libs/caseSupportNotifications";
import { deriveAdministrativePresentationCapabilities } from "@/app/dashboard/administrativeCapabilities";

export default async function CreateFirstClientPage() {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    redirect("/login");
  }
  const [
    provider,
    pendingCaseSupportRequestCount,
    unreadCaseSupportNotificationCount,
  ] = await Promise.all([
    db.provider.findUnique({
      where: { id: session.providerId },
      select: {
        email: true,
        role: true,
        status: true,
        organizationMemberships: {
          where: {
            active: true,
            role: { in: ["OWNER", "ADMIN"] },
          },
          select: { organizationId: true },
        },
      },
    }),
    db.caseSupportRequest.count({
      where: {
        recipientSupervisorId: session.providerId,
        status: "REQUESTED",
      },
    }),
    db.caseSupportNotification.count({
      where: {
        ...caseSupportNotificationAccessWhere(session.providerId),
        readAt: null,
      },
    }),
  ]);

  if (!provider) {
    redirect("/login");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const clients = await db.client.findMany({
    where: {
      providerClients: {
        some: {
          providerId: session.providerId,
          revokedAt: null,
        },
      },
    },
    include: {
      providerClients: {
        where: { revokedAt: null },
        include: {
          provider: true,
        },
      },
      entries: {
        where: {
          date: today,
        },
        select: {
          id: true,
          providerId: true,
          finalScore: true,
          items: true,
          reads: {
            where: {
              providerId: session.providerId,
            },
            select: {
              readAt: true,
            },
          },
        },
      },
    },
  });

  if (clients.length > 0) {
    redirect("/dashboard");
  }

  const administrativeCapabilities =
    deriveAdministrativePresentationCapabilities({
      providerRole: provider.role,
      sessionRole: session.role,
      providerStatus: provider.status,
      isPlatformAdministrator: isPlatformAdminEmail(provider.email),
      administeredOrganizationIds: provider.organizationMemberships.map(
        ({ organizationId }) => organizationId
      ),
      assignedClientIds: [],
      teamManagedClientIds: [],
    });
  const administeredOrganizationIds = provider.organizationMemberships.map(
    ({ organizationId }) => organizationId
  );
  const pendingOrganizationInvitationCount =
    administrativeCapabilities.canReviewOrganizationInvitations
      ? await db.clientOrganization.count({
          where: {
            organizationId: { in: administeredOrganizationIds },
            role: "PARTICIPATING",
            status: "PENDING",
            revokedAt: null,
          },
        })
      : 0;

  return (
    <main style={{ padding: 40, position: "relative" }}>
      <SupervisorDashboard
        assignedClients={clients}
        currentProviderId={session.providerId}
        administrativeCapabilities={administrativeCapabilities}
        newCaseSupportRequestCount={
          pendingCaseSupportRequestCount + unreadCaseSupportNotificationCount
        }
        pendingOrganizationInvitationCount={
          pendingOrganizationInvitationCount
        }
      />
    </main>
  );
}
