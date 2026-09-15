"use client";

import { useState } from "react";
import { ChevronControl } from "@/components/ui/ChevronControl";
import styles from "./page.module.css";

type ReviewedRequest = {
  id: string;
  organizationName: string;
  organizationType: string;
  contactName: string;
  contactEmail: string;
  submittedAt: string;
  status: "APPROVED" | "DECLINED";
  reviewedAt: string | null;
  organizationCreated: boolean;
  approvedOrganizationName: string | null;
};

const organizationTypeLabels: Record<string, string> = {
  AGENCY: "Agency",
  SCHOOL: "School",
  DISTRICT: "School district",
  INDEPENDENT: "Independent",
};

const statusLabels: Record<ReviewedRequest["status"], string> = {
  APPROVED: "Approved",
  DECLINED: "Declined",
};

export default function RequestHistoryCarousel({
  requests,
}: {
  requests: ReviewedRequest[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const request = requests[activeIndex];

  if (!request) return null;

  return (
    <div className={styles.historyCarousel}>
      <nav
        className={styles.historyNavigation}
        aria-label="Reviewed agency requests"
      >
        <ChevronControl
          direction="left"
          treatment="carousel"
          onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
          disabled={activeIndex === 0}
          aria-label="Previous reviewed request"
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
          aria-label="Next reviewed request"
        />
      </nav>

      <article className={`${styles.card} ${styles.historyCard}`}>
        <div className={styles.requestHeading}>
          <h3>{request.organizationName}</h3>
          <span>
            {organizationTypeLabels[request.organizationType] ??
              request.organizationType.toLowerCase()}
          </span>
        </div>

        <div className={styles.statusRow}>
          <span className={styles.statusBadge} data-status={request.status}>
            {statusLabels[request.status]}
          </span>
          {request.status === "APPROVED" && request.organizationCreated ? (
            <span className={styles.organizationCreated}>
              Organization created
              {request.approvedOrganizationName
                ? ` · ${request.approvedOrganizationName}`
                : ""}
            </span>
          ) : null}
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
          <div>
            <dt>Status</dt>
            <dd>{statusLabels[request.status]}</dd>
          </div>
          {request.reviewedAt ? (
            <div>
              <dt>Reviewed</dt>
              <dd>{request.reviewedAt}</dd>
            </div>
          ) : null}
        </dl>
      </article>
    </div>
  );
}
