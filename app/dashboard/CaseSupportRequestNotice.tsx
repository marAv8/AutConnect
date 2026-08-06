import { clientDisplayCode } from "@/app/libs/clientIdentity";
import { formatBadgeRole } from "@/app/libs/roles";
import Link from "next/link";

type RequestNotice = {
  id: string;
  status: string;
  createdAt: Date | string;
  client: {
    firstName: string;
    lastName: string;
  };
  requester: {
    firstName: string;
    lastName: string;
    role: string;
  };
};

export default function CaseSupportRequestNotice({
  requests,
}: {
  requests: RequestNotice[];
}) {
  const first = requests[0];
  const requesterName =
    `${first.requester.firstName} ${first.requester.lastName}`.trim();
  const remaining = requests.length - 1;

  return (
    <Link
      href="/portal/case-support/requests"
      className="paper-surface case-support-dashboard-notice"
      aria-label={`${requests.length} Case Support ${
        requests.length === 1 ? "request" : "requests"
      } awaiting review`}
    >
      <span className="case-support-dashboard-notice-count">
        {requests.length}
      </span>
      <span className="case-support-dashboard-notice-copy">
        <strong>
          Case Support {requests.length === 1 ? "request" : "requests"}
        </strong>
        <span>
          {clientDisplayCode(
            first.client.firstName,
            first.client.lastName
          )}{" "}
          · {requesterName} · {formatBadgeRole(first.requester.role)}
          {remaining > 0 ? ` · +${remaining} more` : ""}
        </span>
      </span>
      <span className="case-support-dashboard-notice-action">Review</span>
    </Link>
  );
}
