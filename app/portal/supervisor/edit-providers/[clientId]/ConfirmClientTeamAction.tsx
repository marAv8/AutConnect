"use client";

export default function ConfirmClientTeamAction({
  children,
  confirmation,
  className = "material-control action-secondary",
}: {
  children: React.ReactNode;
  confirmation: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(confirmation)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
