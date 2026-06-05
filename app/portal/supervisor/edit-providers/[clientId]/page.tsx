//app/portal/supervisor/edit-providers/[clientId]/page.tsx
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { updateClientAssignments } from "@/app/actions/manageSupervisorClients";
import EditClientProvidersForm from "./EditClientProvidersForm";
import Link from "next/link";

export default async function EditClientProvidersPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await getSession();
  if (!session || session.role !== "Supervisor") {
    redirect("/login");
  }

  const { clientId } = await params;

  const access = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: session.providerId,
    },
    select: { id: true },
  });

  if (!access) {
    redirect("/portal/supervisor/edit-providers");
  }

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: { firstName: true, lastName: true },
  });
  if (!client) {
    redirect("/portal/supervisor/edit-providers");
  }

  const providers = await db.provider.findMany({
    where: {
      role: {
        in: [
          "Caregiver",
          "OccupationalTherapist",
          "SpeechPathologist",
          "BehaviorTherapist",
          "Educator",
        ],
      },
    },
    orderBy: { lastName: "asc" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
    },
  });

  const assignments = await db.providerClient.findMany({
    where: { clientId },
    select: { providerId: true, role: true },
  });

  const roleOrder = [
    "Caregiver",
    "BehaviorTherapist",
    "Educator",
    "SpeechPathologist",
    "OccupationalTherapist",
  ];

  const assignedProviderIds = assignments
    .filter((row) => row.role !== "Supervisor")
    .map((row) => row.providerId);
  const HEADER_TO_LINK_GAP = 10;
  const LINK_TO_CONTENT_GAP = 24;

  return (
    <main
      style={{
        padding: "0 32px 24px",
        height: "calc(100vh - 110px)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginTop: HEADER_TO_LINK_GAP, marginBottom: LINK_TO_CONTENT_GAP }}>
        <Link href="/dashboard" className="back-link">
          Client List
        </Link>
      </div>
      <div style={{ display: "flex", justifyContent: "center", height: "calc(100% - 58px)" }}>
        <div style={{ width: "100%", maxWidth: 1100, minHeight: 0 }}>
          <div
            className="paper-surface provider-assignment-panel"
            style={{
              width: "100%",
              height: "100%",
              padding: 28,
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <EditClientProvidersForm
              clientId={clientId}
              onSubmit={updateClientAssignments}
              initialFullName={`${client.firstName} ${client.lastName}`}
              providers={providers}
              initiallyAssignedProviderIds={assignedProviderIds}
              roleOrder={roleOrder}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
