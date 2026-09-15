import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getManagedOrganizationIds,
  requireCurrentPlatformAdmin,
} from "@/lib/authorization";
import { getSession } from "@/lib/session";
import AdministrationCarousel from "./AdministrationCarousel";
import styles from "./page.module.css";

export default async function PlatformAdministrationPage() {
  if (!(await getSession())) {
    redirect("/login");
  }

  const platformAdmin = await requireCurrentPlatformAdmin();
  const managedOrganizationIds = await getManagedOrganizationIds(platformAdmin.id);

  return (
    <main className={styles.page}>
      <div className={styles.content}>
        <div className={styles.backRow}>
          <Link href="/dashboard" className="back-link">
            Back
          </Link>
        </div>

        <div className={styles.titleRow}>
          <h1>Administration</h1>
        </div>

        <AdministrationCarousel
          canManageOrganizations={managedOrganizationIds.length > 0}
        />
      </div>
    </main>
  );
}
