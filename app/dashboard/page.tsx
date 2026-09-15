//app/dashboard/page.tsx
import { getSession } from "@/lib/session";
import {
  activeDocumentationDate,
  sevenDayHistoryStart,
} from "@/app/libs/documentationDay";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { buildDashboardClientSignals } from "@/app/libs/clientSignal/server";
import SupervisorDashboard from "./SupervisorDashboard";
import ProviderDashboard from "./ProviderDashboard";
import { isPlatformAdminEmail } from "@/lib/platformAdminPolicy";
import { caseSupportNotificationAccessWhere } from "@/app/libs/caseSupportNotifications";
import { hasActiveClientTeamManagerAuthority } from "@/lib/clientTeamAuthorization";
import { deriveAdministrativePresentationCapabilities } from "./administrativeCapabilities";
import { prepareDashboardClients } from "./dashboardPageModel";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    clientId?: string;
    view?: string;
  }>;
}) {
  const [session, resolvedSearchParams] = await Promise.all([
    getSession(),
    searchParams,
  ]);

  if (!session) {
    redirect("/login");
  }

  const now = new Date();
  const activeDate = activeDocumentationDate(now);
  const sevenDaysAgo = sevenDayHistoryStart(now);

  const [
    provider,
    initialClients,
    caseSupportRequests,
    caseSupportProviderUpdates,
    caseSupportNotificationCount,
  ] = await Promise.all([
    db.provider.findUnique({
      where: { id: session.providerId },
      select: {
        firstName: true,
        lastName: true,
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
    db.client.findMany({
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
          select: {
            role: true,
            organizationId: true,
            organization: {
              select: {
                type: true,
              },
            },
            provider: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        entries: {
          where: {
            ...(activeDate
              ? { date: activeDate }
              : { id: { in: [] as string[] } }),
            OR: [
              {
                visibility: "Shared",
              },
              {
                providerId: session.providerId,
              },
            ],
          },
          select: {
            id: true,
            providerId: true,
            kind: true,
            visibility: true,
            status: true,
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
        teamFocusItems: {
          orderBy: {
            updatedAt: "desc",
          },
          take: 20,
          select: {
            id: true,
            title: true,
            content: true,
            isActive: true,
            displayStartedAt: true,
            createdAt: true,
            updatedAt: true,
            author: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        caseSupportCases: {
          where: {
            status: "OPEN",
            OR: [
              {
                ownerSupervisorId: session.providerId,
              },
              {
                members: {
                  some: {
                    providerId: session.providerId,
                    revokedAt: null,
                  },
                },
              },
            ],
          },
          take: 1,
          select: {
            id: true,
          },
        },
      },
    }),
    session.role === "Supervisor"
      ? db.caseSupportRequest.findMany({
          where: {
            recipientSupervisorId: session.providerId,
            status: { in: ["REQUESTED", "ACKNOWLEDGED"] },
          },
          orderBy: [{ status: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            status: true,
            createdAt: true,
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            requester: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    session.role !== "Supervisor" && session.role !== "Caregiver"
      ? db.caseSupportRequest.findMany({
          where: {
            requesterId: session.providerId,
            requesterViewedAt: null,
            status: { in: ["ACKNOWLEDGED", "DECLINED", "CASE_OPENED"] },
          },
          orderBy: { updatedAt: "desc" },
          take: 5,
          select: {
            id: true,
            status: true,
            updatedAt: true,
            responseNote: true,
            client: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
            recipientSupervisor: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
        })
      : Promise.resolve([]),
    session.role === "Supervisor"
      ? db.caseSupportNotification.count({
          where: {
            ...caseSupportNotificationAccessWhere(session.providerId),
            readAt: null,
          },
        })
      : Promise.resolve(0),
  ]);

  if (!provider) {
    redirect("/login");
  }

  const clients = initialClients;
  const { clientId, view } = resolvedSearchParams;
  const isSupervisor = session.role === "Supervisor";
  const isCaregiver = session.role === "Caregiver";
  const backToClientListLabel = isCaregiver
    ? "Back to Children"
    : "Back to Client List";

  if (isSupervisor && clients.length === 0) {
    redirect("/portal/supervisor/create-first-client");
  }

  const careTeamClientIds = isSupervisor
    ? (
        await Promise.all(
          clients.map(async (client) =>
            (await hasActiveClientTeamManagerAuthority(
              session.providerId,
              client.id
            ))
              ? client.id
              : null
          )
        )
      ).filter((managedClientId): managedClientId is string =>
        Boolean(managedClientId)
      )
    : [];
  const administrativeCapabilities =
    deriveAdministrativePresentationCapabilities({
      providerRole: provider.role,
      sessionRole: session.role,
      providerStatus: provider.status,
      isPlatformAdministrator: isPlatformAdminEmail(provider.email),
      administeredOrganizationIds: provider.organizationMemberships.map(
        ({ organizationId }) => organizationId
      ),
      assignedClientIds: clients.map(({ id }) => id),
      teamManagedClientIds: careTeamClientIds,
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

  const recentEntries = clients.length
    ? await db.entry.findMany({
        where: {
          clientId: {
            in: clients.map((client) => client.id),
          },
          date: {
            gte: sevenDaysAgo,
          },
          OR: [
            {
              visibility: "Shared",
            },
            {
              providerId: session.providerId,
            },
          ],
          AND: [
            {
          OR: [
            {
              note: {
                not: null,
              },
            },
            {
              items: {
                some: {},
              },
            },
            {
              abcObservations: {
                some: {},
              },
            },
          ],
            },
          ],
        },
        select: {
          id: true,
          clientId: true,
          providerId: true,
          kind: true,
          status: true,
        },
      })
    : [];

  const clientSignals = await buildDashboardClientSignals({
    clientIds: clients.map((client) => client.id),
    viewerProviderId: session.providerId,
    now,
  });

  const dashboardClients = prepareDashboardClients({
    clients,
    recentEntries,
    clientSignals,
    viewerProviderId: session.providerId,
    viewerRole: session.role,
    now,
  });

  return (
    <main className="dashboard-page-shell">
      <section className="dashboard-page-content">
        {isSupervisor ? (
          <SupervisorDashboard
            assignedClients={dashboardClients}
            currentProviderId={session.providerId}
            administrativeCapabilities={administrativeCapabilities}
            newCaseSupportRequestCount={
              caseSupportRequests.filter(
                (request) => request.status === "REQUESTED"
              ).length + caseSupportNotificationCount
            }
            pendingOrganizationInvitationCount={
              pendingOrganizationInvitationCount
            }
            initialClientId={clientId}
            forceOrbitView={view === "orbit"}
          />
        ) : (
          <ProviderDashboard
            clients={dashboardClients}
            currentProviderId={session.providerId}
            viewerRole={session.role}
            initialClientId={clientId}
            forceOrbitView={view === "orbit"}
            clientListLabel={backToClientListLabel.replace("Back to ", "")}
            caseSupportUpdates={caseSupportProviderUpdates}
            canReviewOrganizationInvitations={
              administrativeCapabilities.canReviewOrganizationInvitations
            }
            canAttachExistingClient={
              administrativeCapabilities.canAttachExistingClient
            }
            pendingOrganizationInvitationCount={
              pendingOrganizationInvitationCount
            }
          />
        )}
      </section>
    </main>
  );
}
