"use client";

import { useState } from "react";
import { ChevronControl } from "@/components/ui/ChevronControl";
import AgencyApprovalForm from "./AgencyApprovalForm";
import styles from "./page.module.css";

type AgencyRequest = {
  id: string;
  organizationName: string;
  organizationType: string;
  contactName: string;
  contactEmail: string;
  submittedAt: string;
};

const organizationTypeLabels: Record<string, string> = {
  AGENCY: "Agency",
  SCHOOL: "School",
  DISTRICT: "School district",
  INDEPENDENT: "Independent",
};

export default function AgencyRequestsCarousel({
  requests,
}: {
  requests: AgencyRequest[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const request = requests[activeIndex];

  if (!request) return null;

  return (
    <div className={styles.carousel}>
      <nav
        className={styles.carouselNavigation}
        aria-label="Pending agency requests"
      >
        <ChevronControl
          direction="left"
          treatment="carousel"
          onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          disabled={activeIndex === 0}
          aria-label="Previous agency request"
        />
        <span>
          {activeIndex + 1} of {requests.length}
        </span>
        <ChevronControl
          direction="right"
          treatment="carousel"
          onClick={() =>
            setActiveIndex((index) => Math.min(requests.length - 1, index + 1))
          }
          disabled={activeIndex === requests.length - 1}
          aria-label="Next agency request"
        />
      </nav>

      <section className={styles.card}>
        <p className={styles.explanation}>
          Approve an organization and create a seven-day invitation for its first
          owner.
        </p>

        <div className={styles.requestHeading}>
          <h2>{request.organizationName}</h2>
          <span>
            {organizationTypeLabels[request.organizationType] ??
              request.organizationType.toLowerCase()}
          </span>
        </div>

        <dl className={styles.requestDetails}>
          <div>
            <dt>Contact</dt>
            <dd>{request.contactName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd className={styles.breakableText}>{request.contactEmail}</dd>
          </div>
          <div>
            <dt>Submitted</dt>
            <dd>{request.submittedAt}</dd>
          </div>
        </dl>

        <AgencyApprovalForm key={request.id} requestId={request.id} />
      </section>
    </div>
  );
}
