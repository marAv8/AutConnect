import { notFound } from "next/navigation";
import EntryForm from "@/app/portal/notes/add/EntryForm";
import AuthenticatedPageHeader from "@/app/components/AuthenticatedPageHeader";
import { getProfessionTemplate } from "@/app/libs/professionTemplates";

export default async function TargetWorkflowPage({ searchParams }: { searchParams: Promise<{ role?: string; edit?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const query = await searchParams;
  const role = ["Educator", "SpeechPathologist", "BehaviorTherapist"].includes(query.role ?? "") ? query.role! : "OccupationalTherapist";
  const targetOptions = getProfessionTemplate(role)?.targets ?? [];
  return <main style={{ width: "100%", maxWidth: 1120, margin: "0 auto", padding: 12, boxSizing: "border-box" }}>
    <AuthenticatedPageHeader displayName="Synthetic Provider" role={role} />
    <EntryForm clientId="00000000-0000-4000-8000-000000000001" providerId="00000000-0000-4000-8000-000000000002"
      role={role} providerRole={role} clientName="Synthetic Client" providerName="Synthetic Provider" todayLabel="Synthetic date"
      targetOptions={targetOptions} educatorMode={query.edit === "1" ? undefined : "addTarget"}
      initialValues={{ note: "", items: query.edit === "1" ? [{goalId: "00000000-0000-4000-8000-000000000003", target: "Synthetic target", goal: "Synthetic goal", score: "", metricType: "Subjective", domain: "Other", rawValue: "", supportLevel: "", observation: "", measurementProfile: "Frequency"}] : [] }} />
  </main>;
}
