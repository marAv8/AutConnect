//app/portal/supervisor/edit-providers/page.tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import EditProvidersClient from "./EditProvidersClient";
import { hasActiveClientTeamManagerAuthority } from "@/lib/clientTeamAuthorization";

function getInitials(firstName: string, lastName: string) {
  return `${firstName.slice(0, 2)}${lastName.slice(0, 2)}`;
}

export default async function EditProvidersPage() {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    redirect("/login");
  }
  const managerGrants = await db.clientTeamManager.findMany({
    where: {
      providerId: session.providerId,
      revokedAt: null,
      provider: { status: "ACTIVE" },
    },
    orderBy: { grantedAt: "desc" },
    take: 100,
    select: {
      client: {
        select: { id: true, firstName: true, lastName: true },
      },
    },
  });
  const authorizedClients = (
    await Promise.all(
      managerGrants.map(async ({ client }) =>
        (await hasActiveClientTeamManagerAuthority(
          session.providerId,
          client.id
        ))
          ? client
          : null
      )
    )
  ).filter(
    (client): client is { id: string; firstName: string; lastName: string } =>
      client !== null
  );

  return (
    <EditProvidersClient
      assignedClients={authorizedClients.map((client) => ({
        id: client.id,
        initials: getInitials(client.firstName, client.lastName),
        name: `${client.firstName} ${client.lastName}`,
      }))}
    />
  );
}
