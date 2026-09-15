"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  careTeamDashboardUrl,
  hasTrustedCareTeamDashboardOrigin,
} from "@/app/dashboard/dashboardNavigation";

export default function CareTeamBackControl({ clientId }: { clientId: string }) {
  const router = useRouter();
  const [hasTrustedOrigin, setHasTrustedOrigin] = useState(false);

  useEffect(() => {
    setHasTrustedOrigin(
      hasTrustedCareTeamDashboardOrigin(window.history.state, clientId)
    );
  }, [clientId]);

  const returnToDashboard = () => {
    if (hasTrustedCareTeamDashboardOrigin(window.history.state, clientId)) {
      window.history.back();
      return;
    }
    router.replace(careTeamDashboardUrl(clientId));
  };

  return (
    <button
      type="button"
      className="back-link"
      onClick={returnToDashboard}
      style={{
        border: "none",
        background: "transparent",
        padding: 0,
        font: "inherit",
        cursor: "pointer",
      }}
    >
      {hasTrustedOrigin ? "Back to Client" : "Back to Dashboard"}
    </button>
  );
}
