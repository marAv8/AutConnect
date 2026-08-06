import { getSession } from "@/lib/session";
import { db } from "@/lib/db";
import { formatBadgeRole } from "@/app/libs/roles";
import { logoutProvider } from "@/app/actions/logoutProvider";

export default async function AppUserHeader() {
  const session = await getSession();
  if (!session) return null;

  const provider = await db.provider.findUnique({
    where: { id: session.providerId },
    select: { firstName: true, lastName: true, role: true },
  });
  if (!provider) return null;
  const lastInitial = provider.lastName.trim().charAt(0).toUpperCase();
  const displayName = lastInitial
    ? `${provider.firstName} ${lastInitial}.`
    : provider.firstName;

  return (
    <header className="app-user-header">
      <div className="app-user-header-row">
        <div className="app-user-header-logo" aria-label="AutConnect">
          <span aria-hidden="true" className="brand-mark-light">A</span>
          <span aria-hidden="true" className="brand-mark-strong">C</span>
        </div>

        <div className="app-user-header-identity">
          <div className="app-user-header-title">
            {displayName} — {formatBadgeRole(provider.role)}
          </div>
          <div style={{ marginTop: 10 }}>
            <form action={logoutProvider}>
              <button
                type="submit"
                className="soft-link"
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  color: "inherit",
                  font: "inherit",
                  fontSize: 14,
                  fontWeight: 450,
                  cursor: "pointer",
                }}
              >
                Logout
              </button>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
