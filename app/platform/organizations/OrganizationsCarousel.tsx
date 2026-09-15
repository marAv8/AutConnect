"use client";

import { useState } from "react";
import { ChevronControl } from "@/components/ui/ChevronControl";
import styles from "./page.module.css";

type OrganizationDirectoryEntry = {
  id: string;
  name: string;
  type: string;
  createdAt: string;
  owner: { name: string; email: string } | null;
  administratorCount: number;
  supervisorCount: number;
  providerOrMemberCount: number;
};

const organizationTypeLabels: Record<string, string> = {
  AGENCY: "Agency",
  SCHOOL: "School",
  DISTRICT: "District",
  INDEPENDENT: "Independent",
};

export default function OrganizationsCarousel({
  organizations,
}: {
  organizations: OrganizationDirectoryEntry[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const organization = organizations[activeIndex];

  if (!organization) return null;

  return (
    <div className={styles.carousel}>
      <nav className={styles.carouselNavigation} aria-label="Organizations">
        <ChevronControl
          direction="left"
          treatment="carousel"
          onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          disabled={activeIndex === 0}
          aria-label="Previous organization"
        />
        <span>
          {activeIndex + 1} of {organizations.length}
        </span>
        <ChevronControl
          direction="right"
          treatment="carousel"
          onClick={() =>
            setActiveIndex((index) =>
              Math.min(organizations.length - 1, index + 1)
            )
          }
          disabled={activeIndex === organizations.length - 1}
          aria-label="Next organization"
        />
      </nav>

      <section className={styles.card}>
        <div className={styles.organizationHeading}>
          <h2>{organization.name}</h2>
          <span>
            {organizationTypeLabels[organization.type] ??
              organization.type.toLowerCase()}
          </span>
        </div>

        <dl className={styles.details}>
          <div>
            <dt>Date created</dt>
            <dd>{organization.createdAt}</dd>
          </div>
          <div>
            <dt>Owner</dt>
            <dd>
              {organization.owner ? (
                <span className={styles.ownerIdentity}>
                  <span>{organization.owner.name}</span>
                  <span className={styles.breakableText}>
                    {organization.owner.email}
                  </span>
                </span>
              ) : (
                <span className={styles.neutralMessage}>
                  No active owner is assigned.
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt>Active administrators</dt>
            <dd>{organization.administratorCount}</dd>
          </div>
          <div>
            <dt>Active supervisors</dt>
            <dd>{organization.supervisorCount}</dd>
          </div>
          <div>
            <dt>Active providers or members</dt>
            <dd>{organization.providerOrMemberCount}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
