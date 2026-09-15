"use client";

import Link from "next/link";
import { useState } from "react";
import { ChevronControl } from "@/components/ui/ChevronControl";
import styles from "./page.module.css";

type AdministrationSection = {
  title: string;
  description: string;
  detail?: string;
  href?: string;
  action?: string;
  secondaryHref?: string;
  secondaryAction?: string;
};

export default function AdministrationCarousel({
  canManageOrganizations,
}: {
  canManageOrganizations: boolean;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const sections: AdministrationSection[] = [
    {
      title: "Agency access requests",
      description:
        "Review organizations requesting access and create the first owner invitation for an approved organization.",
      detail:
        "New organizations apply through the public registration form. Approval creates their first owner invitation.",
      href: "/platform/agency-requests",
      action: "Open requests",
      secondaryHref: "/request-agency-access",
      secondaryAction: "View registration form",
    },
    {
      title: "Organizations",
      description:
        "View approved agencies, schools, and districts and see who currently administers them.",
      href: "/platform/organizations",
      action: "Open organizations",
    },
    {
      title: "Team invitations",
      description: canManageOrganizations
        ? "Invite supervisors and providers to organizations you manage."
        : "Team invitations become available when you own or administer an organization.",
      ...(canManageOrganizations
        ? {
            href: "/portal/supervisor/invitations",
            action: "Invite team member",
          }
        : {}),
    },
  ];
  const section = sections[activeIndex];

  return (
    <div className={styles.carousel}>
      <nav
        className={styles.carouselNavigation}
        aria-label="Administration sections"
      >
        <ChevronControl
          direction="left"
          treatment="carousel"
          onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          disabled={activeIndex === 0}
          aria-label="Previous administration section"
        />
        <span>
          {activeIndex + 1} of {sections.length}
        </span>
        <ChevronControl
          direction="right"
          treatment="carousel"
          onClick={() =>
            setActiveIndex((index) => Math.min(sections.length - 1, index + 1))
          }
          disabled={activeIndex === sections.length - 1}
          aria-label="Next administration section"
        />
      </nav>

      <section className={styles.card}>
        <h2>{section.title}</h2>
        <p>{section.description}</p>
        {section.detail ? (
          <p className={styles.cardDetail}>{section.detail}</p>
        ) : null}
        {section.href || section.secondaryHref ? (
          <div className={styles.cardActions}>
            {section.href && section.action ? (
              <Link
                href={section.href}
                className={`action-positive ${styles.openButton}`}
              >
                {section.action}
              </Link>
            ) : null}
            {section.secondaryHref && section.secondaryAction ? (
              <Link
                href={section.secondaryHref}
                className={`action-secondary ${styles.secondaryButton}`}
              >
                {section.secondaryAction}
              </Link>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
