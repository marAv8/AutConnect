import { redirect } from "next/navigation";
import { updateClientDetailsFromCareTeam } from "@/app/actions/manageSupervisorClients";
import {
  searchEligibleClientProviders,
} from "@/app/actions/manageClientTeam";
import AdministrativeCarousel from "@/app/components/administrative/AdministrativeCarousel";
import { getManagedOrganizationIds, requireCurrentSupervisor } from "@/lib/authorization";
import { hasActiveClientTeamManagerAuthority } from "@/lib/clientTeamAuthorization";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import ClientTeamPanel from "./ClientTeamPanel";
import ClientAttachRequestPanel from "./ClientAttachRequestPanel";
import CareTeamInfo from "./CareTeamInfo";
import CareTeamBackControl from "./CareTeamBackControl";
import EditClientProvidersForm from "./EditClientProvidersForm";
import styles from "./CareTeamPage.module.css";

export default async function EditClientProvidersPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  await requireCurrentSupervisor();

  const { clientId } = await params;
  if (!(await hasActiveClientTeamManagerAuthority(session.providerId, clientId))) {
    redirect("/dashboard");
  }

  const client = await db.client.findUnique({
    where: { id: clientId },
    select: {
      caseCode: true,
      firstName: true,
      lastName: true,
      receivesPrescribedMedication: true,
      clientOrganizations: {
        orderBy: [{ role: "asc" }, { requestedAt: "asc" }],
        select: {
          id: true,
          role: true,
          status: true,
          requestedAt: true,
          revokedAt: true,
          revocationReason: true,
          organization: { select: { id: true, name: true, type: true } },
        },
      },
      attachRequests: {
        orderBy: { requestedAt: "desc" },
        take: 50,
        select: {
          id: true,
          status: true,
          requestedAt: true,
          decidedAt: true,
          organization: { select: { name: true, type: true } },
          requestedBy: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });
  if (!client) redirect("/dashboard");

  const activeOrganizations = client.clientOrganizations.filter(
    (relationship) =>
      relationship.status === "ACTIVE" && relationship.revokedAt === null
  );
  const [providerGroups, assignments] = await Promise.all([
    Promise.all(
      activeOrganizations.map(async (relationship) => ({
        organization: relationship.organization,
        providers: await searchEligibleClientProviders(
          clientId,
          relationship.organization.id,
          ""
        ),
      }))
    ),
    db.providerClient.findMany({
      where: { clientId, revokedAt: null, role: { not: "Supervisor" } },
      orderBy: [{ role: "asc" }, { assignedAt: "asc" }],
      take: 100,
      select: {
        id: true,
        role: true,
        provider: { select: { firstName: true, lastName: true } },
        organization: { select: { id: true, name: true, type: true } },
      },
    }),
  ]);

  const providerOptions = providerGroups
    .flatMap(({ organization, providers }) =>
      providers.map((provider) => ({ ...provider, organization }))
    )
    .slice(0, 50);

  const managedOrganizationIds = await getManagedOrganizationIds(session.providerId);
  const pendingStaffInvitations = await db.organizationInvitation.findMany({
    where: { organizationId: { in: activeOrganizations.map(({ organization }) => organization.id).filter(id => managedOrganizationIds.includes(id)) }, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, providerRole: true, organization: { select: { name: true } } },
  });

  return (
    <main className={`provider-assignment-page ${styles.page}`}>
      <div className={styles.container}>
        <CareTeamBackControl clientId={clientId} />
        <header className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>Client administration</p>
            <h1>Care Team</h1>
            <p className={styles.clientIdentity}>
              {client.firstName} {client.lastName}
              <span aria-hidden="true"> · </span>
              <span className={styles.caseCode}>Case {client.caseCode}</span>
              <CareTeamInfo label="About Client case codes">
                Case codes identify a Client but do not grant access.
              </CareTeamInfo>
            </p>
          </div>
        </header>

        <AdministrativeCarousel
          ariaLabel="Care Team administration"
          navigationMode="sections"
          cards={[
            {
              id: "client-details",
              label: "Client Details",
              content: (
                <EditClientProvidersForm
                  clientId={clientId}
                  onSubmit={updateClientDetailsFromCareTeam}
                  initialFullName={`${client.firstName} ${client.lastName}`}
                  initialReceivesPrescribedMedication={client.receivesPrescribedMedication}
                />
              ),
            },
            {
              id: "attach-requests",
              label: "Attach Requests",
              content: <ClientAttachRequestPanel requests={client.attachRequests} />,
            },
            {
              id: "client-organizations",
              label: "Client Organizations",
              content: (
                <ClientTeamPanel
                  mode="organizations"
                  clientId={clientId}
                  caseCode={client.caseCode}
                  relationships={client.clientOrganizations}
                  organizationQuery=""
                  organizationSearchSubmitted={false}
                  organizationSearchTooShort={false}
                  organizationResults={[]}
                  providerQuery=""
                  providerOptions={providerOptions}
                  assignments={assignments}
                  pendingStaffInvitations={pendingStaffInvitations}
                />
              ),
            },
            {
              id: "care-team-providers",
              label: "Care Team Providers",
              content: (
                <ClientTeamPanel
                  mode="providers"
                  clientId={clientId}
                  caseCode={client.caseCode}
                  relationships={client.clientOrganizations}
                  organizationQuery=""
                  organizationSearchSubmitted={false}
                  organizationSearchTooShort={false}
                  organizationResults={[]}
                  providerQuery=""
                  providerOptions={providerOptions}
                  assignments={assignments}
                  pendingStaffInvitations={pendingStaffInvitations}
                />
              ),
            },
          ]}
        />
      </div>
    </main>
  );
}
