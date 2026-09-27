import { notFound } from "next/navigation";
import DashboardContinuityBack from "./DashboardContinuityBack";
import AuthenticatedPageHeader from "@/app/components/AuthenticatedPageHeader";
import FieldObservationForm from "@/app/portal/supervisor/field-observation/[clientId]/FieldObservationForm";
import styles from "@/app/portal/supervisor/field-observation/[clientId]/FieldObservationForm.module.css";
import {
  FIELD_OBSERVATION_RUBRIC, FIELD_OBSERVATION_RATINGS,
  FIELD_OBSERVATION_RATING_DEFINITIONS, FIELD_OBSERVATION_SETTINGS,
} from "@/lib/fieldObservation";

export default async function DashboardContinuityWorkflowPage({ searchParams }: {
  searchParams: Promise<{ form?: string; viewport?: string }>;
}) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  if (query.form === "field") {
    return <>{query.viewport === "1" ? <div className="app-shell-pad"><AuthenticatedPageHeader displayName="Synthetic Supervisor" role="Supervisor" /></div> : null}<main className={styles.page}><FieldObservationForm
      clientId="continuity-client-a" clientFirstName="Alpha"
      providers={[{ id: "continuity-provider-a", firstName: "Bea", lastName: "One", role: "BehaviorTherapist" }]}
      rubric={FIELD_OBSERVATION_RUBRIC} ratings={FIELD_OBSERVATION_RATINGS}
      ratingDefinitions={FIELD_OBSERVATION_RATING_DEFINITIONS}
      settings={FIELD_OBSERVATION_SETTINGS} initialObservedAt="2026-09-18T12:00:00Z"
    /></main></>;
  }
  return <DashboardContinuityBack />;
}
