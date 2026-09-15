"use client";

import { useFormStatus } from "react-dom";

export function InvitationDecisionButton({
  children,
  confirmation,
  className,
  pendingLabel,
}: {
  children: React.ReactNode;
  confirmation: string;
  className: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
