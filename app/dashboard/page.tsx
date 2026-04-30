//app/dashboard/page.tsx
import { getSession } from "@/lib/session";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import Link from "next/link";
import ClientCarousel from "./ClientCarousel";
import SupervisorDashboard from "./SupervisorDashboard";
import NoteHistoryViewer from "@/app/portal/notes/view/NoteHistoryViewer";
import { formatRole } from "@/app/libs/roles";
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
    notesClientId?: string;
    authorProviderId?: string;
  }>;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const provider = await db.provider.findUnique({
    where: { id: session.providerId },
    select: { firstName: true, lastName: true, role: true },
  });

  if (!provider) {
    redirect("/login");
  }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

let clients = await db.client.findMany({
  where: {
    providerClients: {
      some: {
        providerId: session.providerId,
      },
    },
  },
  include: {
    providerClients: {
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

  const { clientId, view, notesClientId, authorProviderId } = await searchParams;
  const isSupervisor = session.role === "Supervisor";
  const isCaregiver = session.role === "Caregiver";
  const backToClientLabel = isCaregiver ? "Back to Children" : "Back to Client";
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

  const noteOverlayClient = notesClientId
    ? await db.client.findFirst({
        where: {
          id: notesClientId,
          providerClients: {
            some: {
              providerId: session.providerId,
            },
          },
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      })
    : null;
  const noteAuthorProviderId = authorProviderId ?? session.providerId;

  const noteOverlayEntries = noteOverlayClient
    ? await db.entry.findMany({
        where: {
          clientId: noteOverlayClient.id,
          providerId: noteAuthorProviderId,
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
        orderBy: {
          date: "desc",
        },
        take: 7,
        select: {
          id: true,
          providerId: true,
          note: true,
          date: true,
          finalScore: true,
          items: {
            orderBy: {
              createdAt: "asc",
            },
            select: {
              target: true,
              goal: true,
              score: true,
              metricType: true,
              domain: true,
              rawValue: true,
              supportLevel: true,
              goalDefinition: {
                select: {
                  targetValue: true,
                  comparison: true,
                },
              },
            },
          },
          provider: {
            select: {
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
      })
    : [];

  if (noteOverlayEntries.length > 0) {
    await db.entryRead.createMany({
      data: noteOverlayEntries.map((entry) => ({
        entryId: entry.id,
        providerId: session.providerId,
        readAt: new Date(),
      })),
      skipDuplicates: true,
    });

    await db.entryRead.updateMany({
      where: {
        providerId: session.providerId,
        entryId: {
          in: noteOverlayEntries.map((entry) => entry.id),
        },
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });

    clients = await db.client.findMany({
      where: {
        providerClients: {
          some: {
            providerId: session.providerId,
          },
        },
      },
      include: {
        providerClients: {
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
  }

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

const clientsWithRecentEntries = clients.map((client) => ({
  ...client,
  recentEntries: recentEntries
    .filter((entry) => entry.clientId === client.id)
    .map((entry) => ({
      id: entry.id,
      providerId: entry.providerId,
    })),
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
            style={{
              fontWeight: 600,
              textDecoration: "none",
            }}
          >
            {backToClientListLabel}
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
      {noteOverlayClient && noteOverlayEntries.length > 0 ? (
        <NoteHistoryViewer
          clientId={noteOverlayClient.id}
          clientInitials={`${noteOverlayClient.firstName.slice(0, 2)}${noteOverlayClient.lastName.slice(0, 2)}`}
          entries={noteOverlayEntries.map((entry) => ({
            id: entry.id,
            note: entry.note ?? "",
            date: entry.date.toISOString(),
            finalScore: entry.finalScore,
            providerName: `${entry.provider.firstName} ${entry.provider.lastName}`,
            providerRole: formatRole(entry.provider.role),
            items: entry.items,
          }))}
          variant="overlay"
          backLabel={backToClientLabel}
        />
      ) : null}
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
    "#e7f0f4",
    "#e7f0de",
    "#ece6f7",
    "#e0eefc",
    "#f4e2ec",
    "#f8ead9",
    "#faefe3",
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
                color: "#2b2b2b",
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
