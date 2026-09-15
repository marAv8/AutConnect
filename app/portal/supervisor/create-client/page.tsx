import { db } from "@/lib/db";
import { createClientWithProviders } from "@/app/actions/createClientWithProviders";
import Link from "next/link";
import CreateClientProvidersForm from "./CreateClientProvidersForm";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  getManagedOrganizationIds,
  requireCurrentSupervisor,
} from "@/lib/authorization";

export default async function CreateClientPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supervisor = await requireCurrentSupervisor();
  const managedOrganizationIds = await getManagedOrganizationIds(supervisor.id);
  const [organizations, providers] = await Promise.all([
    db.organization.findMany({
      where: { id: { in: managedOrganizationIds } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    db.provider.findMany({
      where: {
        status: "ACTIVE",
        role: {
          in: [
            "Caregiver",
            "OccupationalTherapist",
            "SpeechPathologist",
            "BehaviorTherapist",
            "Educator",
          ],
        },
        organizationMemberships: {
          some: {
            active: true,
            organizationId: { in: managedOrganizationIds },
          },
        },
      },
      orderBy: { lastName: "asc" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
        organizationMemberships: {
          where: {
            active: true,
            organizationId: { in: managedOrganizationIds },
          },
          select: { organizationId: true },
        },
      },
    }),
  ]);

  const roleOrder = [
    "Caregiver",
    "BehaviorTherapist",
    "Educator",
    "SpeechPathologist",
    "OccupationalTherapist",
  ];
  const HEADER_TO_LINK_GAP = 10;
  const LINK_TO_CONTENT_GAP = 24;

  return (
    <main
      className="provider-assignment-page"
      style={{
        padding: "12px 24px 48px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "min(100%, 1040px)",
          margin: "0 auto",
          display: "grid",
          gap: LINK_TO_CONTENT_GAP,
        }}
      >
        <div style={{ marginTop: HEADER_TO_LINK_GAP }}>
          <Link href="/dashboard" className="back-link">
            Client List
          </Link>
        </div>
        <div
          className="provider-assignment-page-content"
          style={{ display: "flex", justifyContent: "center" }}
        >
          <div style={{ width: "100%", minWidth: 0 }}>
            <CreateClientProvidersForm
              onSubmit={createClientWithProviders}
              providers={providers.map((provider) => ({
                id: provider.id,
                firstName: provider.firstName,
                lastName: provider.lastName,
                role: provider.role,
                organizationIds: provider.organizationMemberships.map(
                  (membership) => membership.organizationId
                ),
              }))}
              organizations={organizations}
              roleOrder={roleOrder}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
