import { notFound } from "next/navigation";
import DashboardContinuityBack from "./DashboardContinuityBack";

export default function DashboardContinuityWorkflowPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DashboardContinuityBack />;
}
