"use client";

import { createOrganizationInvitation, type OrganizationInvitationState } from "@/app/actions/manageOrganizationInvitations";
import { MaterialSelect } from "@/components/ui/MaterialSelect";
import { useActionState, useId, useState } from "react";
import { initialInvitationState, InvitationResult } from "../../organization/invitations/InvitationCards";
import InvitationInfo from "../../organization/client-invitations/InvitationInfo";
import styles from "../../organization/invitations/invitations.module.css";

type OrganizationOption = { id: string; name: string };
export default function OrganizationInvitationForm({ organizations, onIssued }: { organizations: OrganizationOption[]; onIssued?: (state: OrganizationInvitationState) => void }) {
  const [replacement, setReplacement] = useState(false);
  const [state, formAction, pending] = useActionState(async (previous: OrganizationInvitationState, form: FormData) => {
    const result = await createOrganizationInvitation(previous, form);
    if (result.invitationPath) onIssued?.(result);
    if (result.status === "success") setReplacement(false);
    return result;
  }, initialInvitationState);
  const [organizationId, setOrganizationId] = useState(organizations.length === 1 ? organizations[0].id : "");
  const [email, setEmail] = useState("");
  const [providerRole, setProviderRole] = useState("");
  const id = useId();
  return <form action={formAction} onReset={event => event.preventDefault()} className={`auth-form ${styles.content}`}>
    <div className="auth-field"><label htmlFor={`${id}-organization`}>Organization</label><MaterialSelect id={`${id}-organization`} name="organizationId" value={organizationId} onValueChange={setOrganizationId} required placeholder="Select organization" style={{ width: "100%" }} options={organizations.map(organization => ({ value: organization.id, label: organization.name }))} /></div>
    <div className="auth-field"><label htmlFor={`${id}-email`}>Invited email</label><input id={`${id}-email`} name="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} /></div>
    <div className="auth-field"><label htmlFor={`${id}-role`}>Provider role</label><MaterialSelect id={`${id}-role`} name="providerRole" value={providerRole} onValueChange={setProviderRole} required placeholder="Select role" style={{ width: "100%" }} options={[
      { value: "Supervisor", label: "Supervisor" }, { value: "BehaviorTherapist", label: "Behavior Therapist" }, { value: "SpeechPathologist", label: "Speech Pathologist" }, { value: "OccupationalTherapist", label: "Occupational Therapist" }, { value: "Educator", label: "Educator" }, { value: "Caregiver", label: "Caretaker" },
    ]} /></div>
    {providerRole === "Supervisor" && <p className="form-helper-text">Accepting this invitation grants organization administration.</p>}
    <div><InvitationInfo label="About membership and Client access">Accepting joins the organization. Client team managers assign Client access separately.</InvitationInfo></div>
    <label className={styles.confirm}><input type="checkbox" name="replaceConfirmed" value="yes" checked={replacement} onChange={event => setReplacement(event.target.checked)} />If an unused invitation exists, replace it and invalidate its previous link.</label>
    <p className="form-helper-text">Copy and share the generated link. No email is sent. Invitations expire after 7 days.</p>
    <button className="auth-button" disabled={pending || !organizationId || !email || !providerRole} aria-busy={pending}>{pending ? "Creating…" : "Create Invitation"}</button>
    {state.recipient && <p className="form-helper-text">Created for {state.recipient.email} at {organizations.find(organization => organization.id === state.recipient?.organizationId)?.name} · {state.recipient.providerRole.replace(/([a-z])([A-Z])/g, "$1 $2")}</p>}
    <InvitationResult state={onIssued ? { ...state, invitationPath: undefined } : state} pending={pending} />
  </form>;
}
