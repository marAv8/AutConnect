//app/portal/supervisor/edit-providers/page.tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import EditProvidersClient from "./EditProvidersClient";

function getInitials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 2)}${lastName.slice(0, 2)}`;
}

export default async function EditProvidersPage() {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    redirect("/login");
  }

  const assignedClients = await db.client.findMany({
    where: {
      providerClients: {
        some: {
          providerId: session.providerId,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  const availableClients = await db.client.findMany({
    where: {
      providerClients: {
        none: {
          providerId: session.providerId,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  return (
    <EditProvidersClient
      assignedClients={assignedClients.map((client) => ({
        id: client.id,
        initials: getInitials(client.firstName, client.lastName),
        name: `${client.firstName} ${client.lastName}`,
      }))}
      availableClients={availableClients.map((client) => ({
        id: client.id,
        initials: getInitials(client.firstName, client.lastName),
        name: `${client.firstName} ${client.lastName}`,
      }))}
    />
  );
}
