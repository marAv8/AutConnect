"use client";

import { useFormStatus } from "react-dom";

export default function AdministrativeSubmitButton({
  children,
  pendingLabel,
  className = "material-control action-positive",
  disabled = false,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={className}
      disabled={disabled || pending}
      aria-busy={pending}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
