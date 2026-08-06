import { viewCaseSupportRequestUpdate } from "@/app/actions/manageCaseSupport";
import { clientDisplayCode } from "@/app/libs/clientIdentity";

type ProviderUpdate = {
  id: string;
  status: string;
  updatedAt: Date | string;
  responseNote: string | null;
  client: {
    firstName: string;
    lastName: string;
  };
  recipientSupervisor: {
    firstName: string;
    lastName: string;
  };
};

export default function CaseSupportProviderNotice({
  updates,
}: {
  updates: ProviderUpdate[];
}) {
  const first = updates[0];
  const remaining = updates.length - 1;
  const supervisorName =
    `${first.recipientSupervisor.firstName} ${first.recipientSupervisor.lastName}`.trim();
  const title =
    first.status === "CASE_OPENED"
      ? "Case Support opened"
      : first.status === "ACKNOWLEDGED"
        ? "Case Support request acknowledged"
        : "Case Support response received";

  return (
    <form
      action={viewCaseSupportRequestUpdate}
      className="paper-surface case-support-dashboard-notice"
    >
      <input type="hidden" name="requestId" value={first.id} />
      <span className="case-support-dashboard-notice-count">
        {updates.length}
      </span>
      <span className="case-support-dashboard-notice-copy">
        <strong>{title}</strong>
        <span>
          {clientDisplayCode(first.client.firstName, first.client.lastName)} ·{" "}
          {supervisorName}
          {remaining > 0 ? ` · +${remaining} more` : ""}
        </span>
      </span>
      <button
        type="submit"
        className="case-support-dashboard-notice-action case-support-notice-view-button"
      >
        View
      </button>
    </form>
  );
}
