//app/dashboard/page.tsx
import { getSession } from "@/lib/session";
import {
  activeDocumentationDate,
  sevenDayHistoryStart,
} from "@/app/libs/documentationDay";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientDisplayText } from "@/app/libs/clientIdentity";
import { isTeamFocusVisible } from "@/app/libs/teamFocusLifecycle";
import { buildDashboardClientSignals } from "@/app/libs/clientSignal/server";
import SupervisorDashboard from "./SupervisorDashboard";
import ProviderDashboard from "./ProviderDashboard";

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
  ] = await Promise.all([
    db.provider.findUnique({
      where: { id: session.providerId },
      select: { firstName: true, lastName: true, role: true },
    }),
    db.client.findMany({
      where: {
        providerClients: {
          some: {
            providerId: session.providerId,
          },
        },
      },
      include: {
        providerClients: {
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
          where: {
            isActive: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 1,
          select: {
            id: true,
            title: true,
            content: true,
            displayStartedAt: true,
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

  const availableClients = isSupervisor
    ? await db.client.findMany({
        where: {
          providerClients: {
            none: {
              providerId: session.providerId,
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

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

  const recentEntriesByClientId = new Map<
    string,
    Array<{ id: string; providerId: string; status?: string }>
  >();
  for (const entry of recentEntries) {
    const existing = recentEntriesByClientId.get(entry.clientId);
    const recentEntry = {
      id: entry.id,
      providerId: entry.providerId,
      status: entry.status,
    };

    if (existing) {
      existing.push(recentEntry);
    } else {
      recentEntriesByClientId.set(entry.clientId, [recentEntry]);
    }
  }

  const clientsWithRecentEntries = clients.map((client) => {
    const { caseSupportCases, ...dashboardClient } = client;
    const viewerAssignment = client.providerClients.find(
      ({ provider }) => provider.id === session.providerId
    );
    const canRequestCaseSupport =
      session.role !== "Supervisor" &&
      session.role !== "Caregiver" &&
      viewerAssignment?.organization?.type === "AGENCY" &&
      Boolean(viewerAssignment.organizationId) &&
      client.providerClients.some(
        (assignment) =>
          assignment.role === "Supervisor" &&
          assignment.organizationId === viewerAssignment.organizationId &&
          assignment.organization?.type === "AGENCY"
      );
    return {
      ...dashboardClient,
      hasCaseSupportAccess: caseSupportCases.length > 0,
      canRequestCaseSupport,
      signal: clientSignals.get(client.id),
      recentEntries: recentEntriesByClientId.get(client.id) ?? [],
      teamFocusItems: client.teamFocusItems
        .filter((teamFocus) =>
          isTeamFocusVisible(teamFocus.displayStartedAt, now)
        )
        .map((teamFocus) => ({
          ...teamFocus,
          title: teamFocus.title
            ? clientDisplayText(
                teamFocus.title,
                client.firstName,
                client.lastName
              )
            : null,
          content: clientDisplayText(
            teamFocus.content,
            client.firstName,
            client.lastName
          ),
        })),
    };
  });

  return (
    <main
      className="dashboard-page-shell"
      style={{
        padding: "0 32px 24px",
        position: "relative",
        height: "auto",
        boxSizing: "border-box",
        overflow: "visible",
      }}
    >
      <section
        style={{
          minHeight: "inherit",
        }}
      >
        {isSupervisor ? (
          <SupervisorDashboard
            assignedClients={clientsWithRecentEntries}
            availableClients={availableClients}
            currentProviderId={session.providerId}
            caseSupportRequests={caseSupportRequests}
            initialClientId={clientId}
            forceOrbitView={view === "orbit"}
          />
        ) : (
          <ProviderDashboard
            clients={clientsWithRecentEntries}
            currentProviderId={session.providerId}
            viewerRole={session.role}
            initialClientId={clientId}
            forceOrbitView={view === "orbit"}
            clientListLabel={backToClientListLabel.replace("Back to ", "")}
            caseSupportUpdates={caseSupportProviderUpdates}
          />
        )}
      </section>
    </main>
  );
}
