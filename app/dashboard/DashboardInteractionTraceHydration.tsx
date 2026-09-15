"use client";

import { useEffect } from "react";
import { traceDashboardInteractionState } from "./dashboardInteractionTraceClient";

export default function DashboardInteractionTraceHydration() {
  useEffect(() => {
    traceDashboardInteractionState("hydrated");
  }, []);

  return null;
}
