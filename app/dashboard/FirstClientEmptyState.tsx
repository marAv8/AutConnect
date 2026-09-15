import Link from "next/link";

type Props = {
  canAddClient?: boolean;
  canAttachExistingClient?: boolean;
};

export default function FirstClientEmptyState({
  canAddClient = false,
  canAttachExistingClient = false,
}: Props) {

  return (
    <div
      style={{
        width: "100%",
        minHeight: 420,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "40px 20px 80px",
      }}
    >
      <div style={{ display: "grid", gap: 16, justifyItems: "center" }}>
        {canAddClient ? (
          <Link
            href="/portal/supervisor/create-client"
            style={{
              fontSize: 22,
              fontWeight: 500,
              textDecoration: "none",
              color: "var(--foreground)",
            }}
          >
            Create Your First Client
          </Link>
        ) : (
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 500 }}>
            No assigned Clients yet
          </h2>
        )}
        <p className="form-helper-text" style={{ maxWidth: 520, margin: 0 }}>
          {canAddClient ? "Create a Client to get started." : "Your Client team manager will assign Clients here."}
        </p>
        <Link href="/portal/organization/invitations" className="soft-link">View My Organization Invitations</Link>
        {canAttachExistingClient ? (
          <Link
            href="/portal/organization/attach-client"
            className="soft-link"
            style={{ minHeight: 44, display: "inline-flex", alignItems: "center" }}
          >
            Attach an Existing Client
          </Link>
        ) : null}
      </div>
    </div>
  );
}
