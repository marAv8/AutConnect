"use client";

import { useActionState, useState } from "react";
import {
  requestExistingClientAttachment,
  type ClientAttachRequestState,
} from "@/app/actions/manageClientAttachRequests";
import styles from "./page.module.css";
import AdministrativeCarousel from "@/app/components/administrative/AdministrativeCarousel";

type OrganizationOption = {
  id: string;
  name: string;
  type: string;
};

const initialState: ClientAttachRequestState = {
  status: "idle",
  message: "",
};

export default function AttachClientRequestForm({
  organizations,
}: {
  organizations: OrganizationOption[];
}) {
  const [state, formAction, pending] = useActionState(
    requestExistingClientAttachment,
    initialState
  );
  const [organizationId, setOrganizationId] = useState(
    organizations.length === 1 ? organizations[0]?.id ?? "" : ""
  );
  const [caseCode, setCaseCode] = useState("");
  const selectedOrganization = organizations.find(({ id }) => id === organizationId);

  return (
    <form action={formAction} className={styles.requestForm}>
      <AdministrativeCarousel
        key={state.status}
        ariaLabel="Attach Existing Client request"
        initialCardId={state.status === "idle" ? undefined : "review-request"}
        cards={[
          {
            id: "requesting-organization",
            label: "Requesting Organization",
            content: <div className={styles.field}><label htmlFor="attach-organization">Requesting organization</label><select id="attach-organization" name="organizationId" required value={organizationId} onChange={(event) => setOrganizationId(event.target.value)}><option value="" disabled>Select an organization</option>{organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name} · {organizationTypeLabel(organization.type)}</option>)}</select></div>,
          },
          {
            id: "client-case-code",
            label: "Client Case Code",
            content: <div className={styles.field}><label htmlFor="attach-case-code">Client case code</label><input id="attach-case-code" name="caseCode" type="text" required maxLength={128} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="Enter the case code" value={caseCode} onChange={(event) => setCaseCode(event.target.value)} /><p className={styles.helper}>A case code identifies an existing Client. It does not grant Client access.</p></div>,
          },
          {
            id: "review-request",
            label: "Review and Request",
            content: <div className={styles.requestForm}><p><strong>Organization:</strong> {selectedOrganization?.name ?? "Not selected"}</p><p><strong>Case code:</strong> {caseCode || "Not entered"}</p><p className={styles.helper}>The exact Client Team Manager must approve participation. Approval does not assign Providers.</p><button type="submit" className="material-control action-positive" disabled={pending || !organizationId || !caseCode.trim()} aria-busy={pending}>{pending ? "Submitting…" : "Request participation"}</button>{state.message ? <p className={styles.response} role="status">{state.message}</p> : null}</div>,
          },
        ]}
      />
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
