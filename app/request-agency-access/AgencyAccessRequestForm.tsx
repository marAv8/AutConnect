"use client";

import {
  submitAgencyAccessRequest,
  type AgencyRequestState,
} from "@/app/actions/manageAgencyAccessRequests";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import { useActionState } from "react";

const initialState: AgencyRequestState = { status: "idle" };

export default function AgencyAccessRequestForm() {
  const [state, formAction, pending] = useActionState(
    submitAgencyAccessRequest,
    initialState
  );

  return (
    <form action={formAction} className="auth-form">
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-10000px", width: 1, height: 1 }}
      >
        <label htmlFor="website">Website</label>
        <input id="website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="auth-field">
        <label htmlFor="organizationName">Agency or school name</label>
        <input id="organizationName" name="organizationName" required />
      </div>

      <div className="auth-field">
        <label htmlFor="organizationType">Organization type</label>
        <MaterialSelect
          id="organizationType"
          name="organizationType"
          required
          style={{ width: "100%" }}
          options={[
            { value: "AGENCY", label: "Agency" },
            { value: "SCHOOL", label: "School" },
            { value: "DISTRICT", label: "School district" },
          ]}
        />
      </div>

      <div className="auth-field">
        <label htmlFor="contactFirstName">Administrator first name</label>
        <input
          id="contactFirstName"
          name="contactFirstName"
          autoComplete="given-name"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="contactLastName">Administrator last name</label>
        <input
          id="contactLastName"
          name="contactLastName"
          autoComplete="family-name"
          required
        />
      </div>

      <div className="auth-field">
        <label htmlFor="contactEmail">Company email</label>
        <input
          id="contactEmail"
          name="contactEmail"
          type="email"
          autoComplete="email"
          required
        />
      </div>

      <p className="form-helper-text">
        Submitting this form does not create an account. AutConnect reviews the
        organization first, then sends a secure invitation to its first supervisor.
      </p>

      <button type="submit" className="auth-button" disabled={pending}>
        {pending ? "Submitting…" : "Request Agency Access"}
      </button>

      {state.message ? (
        <p className={state.status === "error" ? "auth-error" : "form-helper-text"}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

