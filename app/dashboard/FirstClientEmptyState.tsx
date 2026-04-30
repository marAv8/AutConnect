import Link from "next/link";

export default function FirstClientEmptyState() {
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
      <Link
        href="/portal/supervisor/create-client"
        style={{
          fontSize: 22,
          fontWeight: 500,
          textDecoration: "none",
          color: "#2b2b2b",
        }}
      >
        Create Your First Client
      </Link>
    </div>
  );
}
