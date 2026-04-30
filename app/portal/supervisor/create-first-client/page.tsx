import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import SupervisorDashboard from "@/app/dashboard/SupervisorDashboard";

export default async function CreateFirstClientPage() {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    redirect("/login");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const clients = await db.client.findMany({
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

  if (clients.length > 0) {
    redirect("/dashboard");
  }

  const availableClients = await db.client.findMany({
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
  });

  return (
    <main style={{ padding: 40, position: "relative" }}>
      <SupervisorDashboard
        assignedClients={clients}
        availableClients={availableClients}
        currentProviderId={session.providerId}
      />
    </main>
  );
}
