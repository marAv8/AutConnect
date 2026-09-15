"use client";

import { useActionState } from "react";
import { cancelClientAttachRequest } from "@/app/actions/manageClientAttachRequests";
import styles from "./page.module.css";

type State = { status: "idle" | "success" | "error"; message: string };

export default function AttachRequestAction({ requestId }: { requestId: string }) {
  const initialState: State = { status: "idle", message: "" };
  const [state, action, pending] = useActionState(
    async (_state: State, formData: FormData): Promise<State> => {
      try {
        await cancelClientAttachRequest(formData);
        return { status: "success", message: "Request cancelled." };
      } catch {
        return {
          status: "error",
          message: "The request could not be cancelled. Refresh and try again.",
        };
      }
    },
    initialState
  );

  return (
    <form
      action={action}
      className={styles.cancelForm}
      onSubmit={(event) => {
        if (!window.confirm("Cancel this pending attach request?")) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <button
        type="submit"
        className="material-control action-secondary"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? "Cancelling…" : "Cancel request"}
      </button>
      {state.message ? (
        <span
          className={styles.actionMessage}
          role={state.status === "error" ? "alert" : "status"}
        >
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
