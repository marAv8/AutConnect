"use client";

import { useActionState } from "react";
import {
  approveClientAttachRequest,
  rejectClientAttachRequest,
} from "@/app/actions/manageClientAttachRequests";
import styles from "./CareTeamPage.module.css";

type Decision = "approve" | "reject";
type State = { status: "idle" | "success" | "error"; message: string };

export default function ClientAttachDecisionCard({
  request,
}: {
  request: {
    id: string;
    requestedAt: Date;
    organization: { name: string; type: string };
    requestedBy: { firstName: string; lastName: string };
  };
}) {
  return (
    <article className={styles.attachRequestCard}>
      <div className={styles.cardTitleRow}>
        <div>
          <strong>{request.organization.name}</strong>
          <div className={styles.providerMeta}>
            <span>{organizationTypeLabel(request.organization.type)}</span>
            <span>Requested {request.requestedAt.toLocaleDateString()}</span>
            <span>
              By {request.requestedBy.firstName} {request.requestedBy.lastName}
            </span>
          </div>
        </div>
        <span className={`${styles.statusBadge} ${styles.pending}`}>Pending</span>
      </div>
      <div className={styles.attachDecisionForms}>
        <DecisionForm requestId={request.id} decision="approve" />
        <DecisionForm requestId={request.id} decision="reject" />
      </div>
    </article>
  );
}

function DecisionForm({
  requestId,
  decision,
}: {
  requestId: string;
  decision: Decision;
}) {
  const action =
    decision === "approve"
      ? approveClientAttachRequest
      : rejectClientAttachRequest;
  const initialState: State = { status: "idle", message: "" };
  const [state, formAction, pending] = useActionState(
    async (_state: State, formData: FormData): Promise<State> => {
      try {
        await action(formData);
        return {
          status: "success",
          message:
            decision === "approve" ? "Request approved." : "Request rejected.",
        };
      } catch {
        return {
          status: "error",
          message: "The request could not be changed. Refresh and try again.",
        };
      }
    },
    initialState
  );
  const label = decision === "approve" ? "Approve" : "Reject";
  const reasonId = `${decision}-reason-${requestId}`;

  return (
    <form
      action={formAction}
      className={styles.attachDecisionForm}
      onSubmit={(event) => {
        const consequence =
          decision === "approve"
            ? "Approve this organization for Client participation? No provider will be assigned automatically."
            : "Reject this organization attach request?";
        if (!window.confirm(consequence)) event.preventDefault();
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor={reasonId}>Decision note (optional)</label>
      <input
        id={reasonId}
        name="reason"
        type="text"
        maxLength={256}
        placeholder={decision === "approve" ? "Approval note" : "Rejection note"}
      />
      <button
        type="submit"
        className={`material-control ${
          decision === "approve" ? "action-positive" : "action-secondary"
        }`}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? `${label}…` : label}
      </button>
      {state.message ? (
        <span
          className="form-helper-text"
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}

function organizationTypeLabel(type: string) {
  return (
    {
      AGENCY: "Agency",
      SCHOOL: "School",
      DISTRICT: "District",
      INDEPENDENT: "Independent",
    }[type] ?? type
  );
}
