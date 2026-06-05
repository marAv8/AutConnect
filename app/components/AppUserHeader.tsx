//app/components/AppUserHeader.tsx
import Link from "next/link";
import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatRole } from "@/app/libs/roles";

export default async function AppUserHeader() {
  const session = await getSession();
  if (!session) return null;

  const provider = await db.provider.findUnique({
    where: { id: session.providerId },
    select: { firstName: true, lastName: true, role: true },
  });
  if (!provider) return null;

  return (
    <header style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 24,
          width: "100%",
        }}
      >
        <div style={{ fontSize: 28, fontWeight: 650, lineHeight: 1, color: "rgb(0 0 0 / 82%)" }}>AC</div>

        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 550, color: "rgb(0 0 0 / 80%)" }}>
            {provider.firstName} {provider.lastName} -- {formatRole(provider.role)}
          </div>
          <div style={{ marginTop: 10 }}>
            <Link href="/login" className="soft-link" style={{ fontSize: 14, fontWeight: 550 }}>
              Logout
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
