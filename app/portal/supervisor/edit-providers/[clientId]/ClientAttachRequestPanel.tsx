import ClientAttachDecisionCard from "./ClientAttachDecisionCard";
import CareTeamInfo from "./CareTeamInfo";
import styles from "./CareTeamPage.module.css";

type AttachRequest = {
  id: string;
  status: string;
  requestedAt: Date;
  decidedAt: Date | null;
  organization: { name: string; type: string };
  requestedBy: { firstName: string; lastName: string };
};

export default function ClientAttachRequestPanel({
  requests,
}: {
  requests: AttachRequest[];
}) {
  const pending = requests.filter(({ status }) => status === "PENDING");
  const history = requests.filter(({ status }) => status !== "PENDING");

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeading}>
        <div>
          <p className={styles.sectionStep}>Participation requests</p>
          <div className={styles.headingTitleRow}>
            <h2>Attach requests</h2>
            <CareTeamInfo label="About attach requests">
              An organization administrator requested participation using this
              Client&apos;s case code. Only an active Team Manager for this exact
              Client may decide. Approval activates the organization but assigns no
              provider and grants no organization-wide Client access.
            </CareTeamInfo>
          </div>
        </div>
        <span className={styles.statusBadge}>{pending.length} pending</span>
      </div>

      {pending.length ? (
        <div className={styles.attachRequestList}>
          {pending.map((request) => (
            <ClientAttachDecisionCard key={request.id} request={request} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <h3>No pending attach requests</h3>
          <p>No organization is waiting for participation approval.</p>
        </div>
      )}

      {history.length ? (
        <div className={styles.subsection}>
          <h3>Recent decisions</h3>
          <div className={styles.relationshipList}>
            {history.map((request) => (
              <div key={request.id} className={styles.row}>
                <div>
                  <strong>{request.organization.name}</strong>
                  <div className="form-helper-text">
                    Requested {request.requestedAt.toLocaleDateString()}
                    {request.decidedAt
                      ? ` · Decided ${request.decidedAt.toLocaleDateString()}`
                      : ""}
                  </div>
                </div>
                <span className={styles.statusBadge}>
                  {requestStatusLabel(request.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function requestStatusLabel(status: string) {
  return (
    {
      APPROVED: "Approved",
      REJECTED: "Rejected",
      CANCELLED: "Cancelled",
    }[status] ?? status
  );
}
