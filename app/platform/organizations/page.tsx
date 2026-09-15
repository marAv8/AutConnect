import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { requireCurrentPlatformAdmin } from "@/lib/authorization";
import OrganizationsCarousel from "./OrganizationsCarousel";
import styles from "./page.module.css";
import { formatProviderDisplayName } from "@/app/libs/providerDisplayName";

export default async function OrganizationsPage() {
  if (!(await getSession())) {
    redirect("/login");
  }

  await requireCurrentPlatformAdmin();

  const organizations = await db.organization.findMany({
    orderBy: [{ name: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      name: true,
      type: true,
      createdAt: true,
      memberships: {
        where: { active: true },
        select: {
          role: true,
          provider: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  const directoryEntries = organizations.map((organization) => {
    const owner = organization.memberships.find(
      (membership) => membership.role === "OWNER"
    )?.provider;

    return {
      id: organization.id,
      name: organization.name,
      type: organization.type,
      createdAt: organization.createdAt.toLocaleDateString(undefined, {
        dateStyle: "medium",
      }),
      owner: owner
        ? {
            name: formatProviderDisplayName(owner.firstName, owner.lastName),
            email: owner.email,
          }
        : null,
      administratorCount: organization.memberships.filter(
        (membership) =>
          membership.role === "OWNER" || membership.role === "ADMIN"
      ).length,
      supervisorCount: organization.memberships.filter(
        (membership) => membership.provider.role === "Supervisor"
      ).length,
      providerOrMemberCount: organization.memberships.filter(
        (membership) => membership.provider.role !== "Supervisor"
      ).length,
    };
  });

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className={styles.backRow}>
          <Link href="/platform" className="back-link">
            Back
          </Link>
        </div>

        <div className={styles.titleRow}>
          <h1>Organizations</h1>
        </div>

        {directoryEntries.length === 0 ? (
          <section className={`${styles.card} ${styles.emptyCard}`}>
            <div className={styles.emptyCopy}>
              <h2>No organizations yet</h2>
              <p>Approved agencies, schools, and districts will appear here.</p>
            </div>
            <Link
              href="/platform/agency-requests"
              className={`action-positive ${styles.openButton}`}
            >
              Open access requests
            </Link>
          </section>
        ) : (
          <OrganizationsCarousel organizations={directoryEntries} />
        )}
      </div>
    </main>
  );
}
