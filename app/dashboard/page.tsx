//app/dashboard/page.tsx
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import ClientCarousel from "./ClientCarousel";
import SupervisorDashboard from "./SupervisorDashboard";
import {
  CLIENT_ORB_FONT_SIZE,
  CLIENT_ORB_SIZE,
  GRID_VISIBLE_COLUMNS,
  GRID_VISIBLE_ROWS,
  MODE_GRID_GAP,
  STATUS_BADGE_CLEARANCE,
} from "./layoutConfig";

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

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [provider, initialClients] = await Promise.all([
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
            date: today,
          },
          select: {
            id: true,
            providerId: true,
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
    }),
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
              note: {
                not: null,
              },
            },
            {
              items: {
                some: {},
              },
            },
          ],
        },
        select: {
          id: true,
          clientId: true,
          providerId: true,
        },
      })
    : [];

  const recentEntriesByClientId = new Map<
    string,
    Array<{ id: string; providerId: string }>
  >();
  for (const entry of recentEntries) {
    const existing = recentEntriesByClientId.get(entry.clientId);
    const recentEntry = {
      id: entry.id,
      providerId: entry.providerId,
    };

    if (existing) {
      existing.push(recentEntry);
    } else {
      recentEntriesByClientId.set(entry.clientId, [recentEntry]);
    }
  }

  const clientsWithRecentEntries = clients.map((client) => ({
    ...client,
    recentEntries: recentEntriesByClientId.get(client.id) ?? [],
  }));

  const shouldShowProviderClientList =
    !isSupervisor && clientsWithRecentEntries.length > 1 && view !== "orbit";
  const providerInitialClientId =
    clientsWithRecentEntries.length === 1
      ? clientsWithRecentEntries[0]?.id
      : clientId;

  return (
    <main
      style={{
        padding: "0 32px 24px",
        position: "relative",
        height: "calc(100vh - 110px)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <section
        style={{
          marginTop: isSupervisor ? 0 : 48,
          height: isSupervisor ? "100%" : undefined,
        }}
      >
        {!isSupervisor && !shouldShowProviderClientList && clients.length > 1 ? (
          <Link
            href="/dashboard"
            className="back-link"
          >
            {backToClientListLabel.replace("Back to ", "")}
          </Link>
        ) : null}
        {clients.length === 0 && (
          <p style={{ opacity: 0.6 }}>
            You don’t have any assigned clients yet.
          </p>
        )}

        {isSupervisor ? (
          <SupervisorDashboard
            assignedClients={clientsWithRecentEntries}
            availableClients={availableClients}
            currentProviderId={session.providerId}
            initialClientId={clientId}
            forceOrbitView={view === "orbit"}
          />
        ) : shouldShowProviderClientList ? (
          <ProviderClientList clients={clientsWithRecentEntries} />
        ) : (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 40,
              flexWrap: "wrap",
              gap: 80,
            }}
          >
            <ClientCarousel
              clients={clientsWithRecentEntries}
              currentProviderId={session.providerId}
              viewerRole={session.role}
              initialClientId={providerInitialClientId}
            />
          </div>
        )}
      </section>
    </main>
  );
}

function ProviderClientList({
  clients,
}: {
  clients: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
}) {
  const palette = [
    "#e1e1e1",
    "#ededed",
    "#d9d9d9",
    "#f4f4f4",
    "#e6e6e6",
    "#eeeeee",
    "#d5d5d5",
  ];
  const visibleWidth =
    CLIENT_ORB_SIZE * GRID_VISIBLE_COLUMNS + MODE_GRID_GAP * (GRID_VISIBLE_COLUMNS - 1);
  const visibleHeight =
    CLIENT_ORB_SIZE * GRID_VISIBLE_ROWS + MODE_GRID_GAP * (GRID_VISIBLE_ROWS - 1);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        paddingTop: 80,
        width: "100%",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: visibleWidth + 16,
          maxHeight: visibleHeight + STATUS_BADGE_CLEARANCE + 16,
          margin: "0 auto",
          overflowY: "auto",
          overflowX: "hidden",
          paddingTop: STATUS_BADGE_CLEARANCE,
          paddingRight: 8,
          boxSizing: "border-box",
          scrollbarGutter: "stable both-edges",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: MODE_GRID_GAP,
            justifyContent: "center",
            alignItems: "center",
            width: "100%",
            minHeight: visibleHeight,
            alignContent:
              clients.length <= GRID_VISIBLE_COLUMNS ? "center" : "flex-start",
          }}
        >
          {clients.map((client, index) => (
            <Link
              key={client.id}
              href={`/dashboard?clientId=${client.id}&view=orbit`}
              title={`${client.firstName} ${client.lastName}`}
              style={{
                width: CLIENT_ORB_SIZE,
                height: CLIENT_ORB_SIZE,
                borderRadius: "50%",
                background: palette[index % palette.length],
                color: "var(--foreground)",
                boxShadow: "var(--shadow-dashboard-sphere)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 auto",
                fontSize: CLIENT_ORB_FONT_SIZE,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {client.firstName.slice(0, 2)}
              {client.lastName.slice(0, 2)}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
