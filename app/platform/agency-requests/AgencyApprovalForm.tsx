"use client";

import {
  approveAgencyAccessRequest,
  type AgencyApprovalState,
} from "@/app/actions/manageAgencyAccessRequests";
import { useActionState, useState } from "react";
import styles from "./page.module.css";

const initialState: AgencyApprovalState = { status: "idle" };

export default function AgencyApprovalForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState(
    approveAgencyAccessRequest,
    initialState
  );
  const [copied, setCopied] = useState(false);
  const invitationUrl = state.invitationPath
    ? new URL(state.invitationPath, window.location.origin).toString()
    : "";

  return (
    <form action={formAction} className={styles.approvalForm}>
      <input type="hidden" name="requestId" value={requestId} />
      <button type="submit" className="auth-button" disabled={pending}>
        {pending ? "Approving…" : "Approve and Create Owner Invitation"}
      </button>
      {state.message ? (
        <p
          className={`${
            state.status === "error" ? "auth-error" : "form-helper-text"
          } ${styles.approvalMessage}`}
        >
          {state.message}
        </p>
      ) : null}
      {invitationUrl ? (
        <div className={`${styles.invitationField} auth-field`}>
          <label htmlFor={`invitation-${requestId}`}>Owner invitation</label>
          <input
            id={`invitation-${requestId}`}
            className={styles.invitationUrl}
            value={invitationUrl}
            readOnly
          />
          <button
            type="button"
            className="auth-button"
            onClick={async () => {
              await navigator.clipboard.writeText(invitationUrl);
              setCopied(true);
            }}
          >
            {copied ? "Copied" : "Copy Link"}
          </button>
        </div>
      ) : null}
    </form>
  );
}
