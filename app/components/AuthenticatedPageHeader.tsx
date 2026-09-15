import Link from "next/link";
import { logoutProvider } from "@/app/actions/logoutProvider";
import { formatBadgeRole } from "@/app/libs/roles";

type Props = {
  displayName: string;
  role: string;
};

export default function AuthenticatedPageHeader({
  displayName,
  role,
}: Props) {
  return (
    <header className="app-user-header">
      <div className="app-user-header-row">
        <Link
          href="/dashboard"
          className="app-user-header-logo"
          aria-label="AutConnect dashboard"
        >
          <span aria-hidden="true" className="brand-mark-light">
            A
          </span>
          <span aria-hidden="true" className="brand-mark-strong">
            C
          </span>
        </Link>

        <div className="app-user-header-identity">
          <div className="app-user-header-title">
            {displayName} — {formatBadgeRole(role)}
          </div>
          <form action={logoutProvider} className="app-user-header-logout-row">
            <button
              type="submit"
              className="soft-link app-user-header-logout"
            >
              Logout
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
