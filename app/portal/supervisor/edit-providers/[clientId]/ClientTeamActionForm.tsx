"use client";

import { useActionState } from "react";

type ActionState = { status: "idle" | "success" | "error"; message: string };

export default function ClientTeamActionForm({
  action,
  fields,
  label,
  pendingLabel,
  confirmation,
  successMessage,
  className = "material-control action-secondary",
}: {
  action: (formData: FormData) => void | Promise<void>;
  fields: Record<string, string>;
  label: string;
  pendingLabel: string;
  confirmation: string;
  successMessage: string;
  className?: string;
}) {
  const initialState: ActionState = { status: "idle", message: "" };
  const [state, formAction, pending] = useActionState(
    async (_state: ActionState, formData: FormData): Promise<ActionState> => {
      try {
        await action(formData);
        return { status: "success", message: successMessage };
      } catch {
        return {
          status: "error",
          message: "The change could not be completed. Refresh and try again.",
        };
      }
    },
    initialState
  );

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        className={className}
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? pendingLabel : label}
      </button>
      {state.message ? (
        <span role={state.status === "error" ? "alert" : "status"} className="form-helper-text">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
