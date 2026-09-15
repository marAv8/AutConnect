import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireCurrentSupervisor } from "@/lib/authorization";
import {
  FIELD_OBSERVATION_ELIGIBLE_ROLES,
  FIELD_OBSERVATION_RATING_DEFINITIONS,
  FIELD_OBSERVATION_RATINGS,
  FIELD_OBSERVATION_RUBRIC,
  FIELD_OBSERVATION_SETTINGS,
} from "@/lib/fieldObservation";
import FieldObservationForm from "./FieldObservationForm";
import styles from "./FieldObservationForm.module.css";

export default async function FieldObservationPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  let supervisor: Awaited<ReturnType<typeof requireCurrentSupervisor>>;

  try {
    supervisor = await requireCurrentSupervisor();
  } catch {
    redirect("/login");
  }

  const { clientId } = await params;
  const assignment = await db.providerClient.findFirst({
    where: {
      clientId,
      providerId: supervisor.id,
      role: "Supervisor",
      revokedAt: null,
    },
    select: {
      client: {
        select: {
          firstName: true,
          lastName: true,
          providerClients: {
            where: {
              role: { in: [...FIELD_OBSERVATION_ELIGIBLE_ROLES] },
              revokedAt: null,
            },
            orderBy: [
              { provider: { lastName: "asc" } },
              { provider: { firstName: "asc" } },
            ],
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
        },
      },
    },
  });

  if (!assignment) {
    redirect("/dashboard");
  }

  return (
    <main className={styles.page}>
      <FieldObservationForm
        clientId={clientId}
        clientFirstName={assignment.client.firstName}
        providers={assignment.client.providerClients.map((providerClient) => ({
          id: providerClient.provider.id,
          firstName: providerClient.provider.firstName,
          lastName: providerClient.provider.lastName,
          role: providerClient.role,
        }))}
        rubric={FIELD_OBSERVATION_RUBRIC}
        ratings={FIELD_OBSERVATION_RATINGS}
        ratingDefinitions={FIELD_OBSERVATION_RATING_DEFINITIONS}
        settings={FIELD_OBSERVATION_SETTINGS}
        initialObservedAt={new Date().toISOString()}
      />
    </main>
  );
}
