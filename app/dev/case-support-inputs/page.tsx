import { notFound } from "next/navigation";
import { CaseSupportRequestCarousel } from "@/app/portal/case-support/request/[clientId]/CaseSupportRequestCarousel";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import FieldObservationForm from "@/app/portal/supervisor/field-observation/[clientId]/FieldObservationForm";
import fieldStyles from "@/app/portal/supervisor/field-observation/[clientId]/FieldObservationForm.module.css";
import { FIELD_OBSERVATION_RUBRIC, FIELD_OBSERVATION_RATINGS, FIELD_OBSERVATION_RATING_DEFINITIONS, FIELD_OBSERVATION_SETTINGS } from "@/lib/fieldObservation";
export default async function CaseSupportInputs({searchParams}:{searchParams:Promise<{workflow?:string}>}) {
  if (process.env.NODE_ENV === "production") notFound();
  const {workflow}=await searchParams;
  if(workflow==='field') return <main className={fieldStyles.page}><FieldObservationForm clientId="synthetic" clientFirstName="Synthetic" providers={[{id:'synthetic',firstName:'Synthetic',lastName:'Provider',role:'BehaviorTherapist'}]} rubric={FIELD_OBSERVATION_RUBRIC} ratings={FIELD_OBSERVATION_RATINGS} ratingDefinitions={FIELD_OBSERVATION_RATING_DEFINITIONS} settings={FIELD_OBSERVATION_SETTINGS} initialObservedAt="2026-09-20T16:12:00Z" /></main>;
  if(workflow==='supervisor'||workflow==='provider') return <main className="case-support-page"><form className="paper-surface case-support-card">
    <h2 className="case-support-section-title">Add Update</h2><div className="case-support-form-grid">
      <label className="case-support-field"><span>Date and time</span><input type="datetime-local" name="occurredAt" required defaultValue="2026-09-20T16:12" /></label>
      <div className="case-support-field"><label htmlFor="source">{workflow==='supervisor'?'Source':'Initiated by'}</label><MaterialSelect id="source" name="requestSource" options={[{value:'',label:'Select one'},{value:'SELF_INITIATED',label:'Provider'}]} /></div>
      <label className="case-support-field"><span>Approximate duration (minutes)</span><input type="number" name="durationMinutes" min={1} max={720} placeholder="Optional" /></label>
    </div><label className="case-support-field"><span>What occurred?</span><textarea name="whatOccurred" /></label>
  </form></main>;
  return <main className="case-support-page"><CaseSupportRequestCarousel clientId="synthetic" supervisors={[{id:"synthetic",name:"Synthetic Supervisor"}]} /></main>;
}
