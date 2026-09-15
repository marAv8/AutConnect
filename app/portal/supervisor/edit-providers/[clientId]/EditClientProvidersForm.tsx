"use client";

import {
  type ClientDetailsUpdateState,
} from "@/app/actions/manageSupervisorClients";
import { useActionState, useMemo, useState } from "react";
import styles from "./CareTeamPage.module.css";

const initialState: ClientDetailsUpdateState = { status: "idle", message: "" };

export default function EditClientProvidersForm({
  clientId,
  onSubmit,
  initialFullName,
  initialReceivesPrescribedMedication,
}: {
  clientId: string;
  onSubmit: (
    previousState: ClientDetailsUpdateState,
    formData: FormData
  ) => Promise<ClientDetailsUpdateState>;
  initialFullName: string;
  initialReceivesPrescribedMedication: boolean;
}) {
  const [fullName, setFullName] = useState(initialFullName);
  const [receivesPrescribedMedication, setReceivesPrescribedMedication] =
    useState(initialReceivesPrescribedMedication);
  const [state, formAction, pending] = useActionState(onSubmit, initialState);
  const initials = useMemo(() => {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    return `${parts[0]?.slice(0, 2) ?? ""}${
      parts.length > 1 ? parts.at(-1)?.slice(0, 2) ?? "" : ""
    }`;
  }, [fullName]);

  return (
    <form action={formAction} className={styles.detailsForm}>
      <input type="hidden" name="clientId" value={clientId} />
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Client full name</span>
        <input
          name="fullName"
          value={fullName}
          onChange={(event) => setFullName(event.target.value)}
        />
      </label>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>Client initials</span>
        <input value={initials} readOnly />
      </label>
      <fieldset className={styles.fieldGroup}>
        <legend>Does the client receive prescribed medication?</legend>
        <div className={styles.radioRow}>
          <div className={styles.radioChoice}>
            <input
              className={styles.radioInput}
              id="medication-yes"
              type="radio"
              name="receivesPrescribedMedication"
              value="true"
              checked={receivesPrescribedMedication}
              onChange={() => setReceivesPrescribedMedication(true)}
              required
            />
            <label className={styles.radioOption} htmlFor="medication-yes">
              Yes
            </label>
          </div>
          <div className={styles.radioChoice}>
            <input
              className={styles.radioInput}
              id="medication-no"
              type="radio"
              name="receivesPrescribedMedication"
              value="false"
              checked={!receivesPrescribedMedication}
              onChange={() => setReceivesPrescribedMedication(false)}
              required
            />
            <label className={styles.radioOption} htmlFor="medication-no">
              No
            </label>
          </div>
        </div>
      </fieldset>
      <button
        type="submit"
        className={`material-control action-positive ${styles.detailsSubmit}`}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Updating…" : "Update client details"}
      </button>
      {state.message ? (
        <p
          className={styles.detailsMessage}
          role={state.status === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
