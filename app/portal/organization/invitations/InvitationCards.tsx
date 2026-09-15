"use client";

import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { decideOrganizationInvitation, manageOrganizationInvitation, type OrganizationInvitationState } from "@/app/actions/manageOrganizationInvitations";
import InvitationInfo from "../client-invitations/InvitationInfo";
import styles from "./invitations.module.css";
import { copyInvitationLink } from "@/lib/organizationInvitationState";

export const initialInvitationState: OrganizationInvitationState = { status: "idle" };
const subscribeToOrigin = () => () => {};
const readOrigin = () => window.location.origin;
const serverOrigin = () => "";
export function InvitationResult({ state, pending = false }: { state: OrganizationInvitationState; pending?: boolean }) {
  const feedbackRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message || pending) feedbackRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [state.message, state.invitationPath, pending]);
  const origin = useSyncExternalStore(subscribeToOrigin, readOrigin, serverOrigin);
  const [copyState, setCopyState] = useState({ path: "", message: "" });
  const [copyPending, setCopyPending] = useState(false);
  const id = useId();
  const link = state.invitationPath && origin ? new URL(state.invitationPath, origin).href : "";
  return <div ref={feedbackRef} className={styles.feedback} aria-live="polite">
    {pending && <p role="status">Processing invitation…</p>}
    {state.message && <p className={state.status === "error" ? "auth-error" : "form-helper-text"} role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
    {link && <div className="auth-field" data-swipe-ignore="true">
      <label htmlFor={id}>Invitation link — copy and share directly</label>
      <input id={id} value={link} readOnly onFocus={event => event.target.select()} />
      <button type="button" className="auth-button" disabled={copyPending} aria-busy={copyPending} onClick={async () => {
        setCopyPending(true);
        setCopyState({ path: link, message: "Copying…" });
        const message = await copyInvitationLink(link, value => navigator.clipboard.writeText(value));
        setCopyState({ path: link, message });
        setCopyPending(false);
      }}>{copyPending ? "Copying…" : "Copy Link"}</button>
      {copyState.path === link && <p role="status">{copyState.message}</p>}
    </div>}
  </div>;
}

export type InvitationRecord = {
  id: string; organization: string; email: string; role: string;
  status: string; expiration: string; membershipRole: string;
};
export function invitationRoleLabel(role: string) {
  return ({ BehaviorTherapist: "Behavior Therapist", SpeechPathologist: "Speech Pathologist", OccupationalTherapist: "Occupational Therapist", Caregiver: "Caretaker" } as Record<string, string>)[role] ?? role;
}
export default function InvitationCard({ invitation, administrator = false, onIssued }: { invitation: InvitationRecord; administrator?: boolean; onIssued?: (state: OrganizationInvitationState) => void }) {
  const [replacement, setReplacement] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [correctionConfirmed, setCorrectionConfirmed] = useState(false);
  const [correctedEmail, setCorrectedEmail] = useState("");
  const [link, setLink] = useState("");
  const [submittedLink, setSubmittedLink] = useState("");
  const [state, action, pending] = useActionState(async (previous: OrganizationInvitationState, form: FormData) => {
    setSubmittedLink(String(form.get("invitationLink") ?? ""));
    const result = await (administrator ? manageOrganizationInvitation : decideOrganizationInvitation)(previous, form);
    if (result.invitationPath) onIssued?.(result);
    if (result.status === "success") { setReplacement(false); setCorrectionConfirmed(false); }
    return result;
  }, initialInvitationState);
  const linkId = useId();
  const actionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.message || pending) actionRef.current?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [state.message, pending]);
  const actionable = invitation.status === "Pending";
  return <form action={action} noValidate onReset={event => event.preventDefault()} className={`auth-form ${styles.content}`}>
    <input type="hidden" name="invitationId" value={invitation.id} />
    {!administrator && actionable && <div ref={actionRef} className="auth-form" data-swipe-ignore="true">
      <p>{invitationRoleLabel(invitation.role)} · Pending</p>
      <p className="form-helper-text">Accepting grants {invitation.membershipRole === "MEMBER" ? "organization membership" : "organization administration"}. It does not assign Clients.</p>
      <div className="auth-field"><label htmlFor={linkId}>Invitation link</label><input id={linkId} name="invitationLink" type="url" value={link} onChange={event => setLink(event.target.value)} required autoComplete="off" /></div>
      <InvitationResult state={state.status === "error" && submittedLink !== link ? initialInvitationState : state} pending={pending} />
      <div className={styles.actions}>
        <button name="decision" value="accept" className="auth-button" disabled={pending || !link} aria-busy={pending}>{pending ? "Processing…" : "Accept Invitation"}</button>
        <button name="decision" value="decline" className="auth-button" disabled={pending || !link} aria-busy={pending}>Decline</button>
      </div>
    </div>}
    <p><strong>Organization:</strong> {invitation.organization}</p>
    <p><strong>Invited person:</strong> {invitation.email}</p>
    <p><strong>Role:</strong> {invitationRoleLabel(invitation.role)}{invitation.membershipRole !== "MEMBER" ? ` · Organization ${invitation.membershipRole.toLowerCase()}` : ""}</p>
    <p><strong>Status:</strong> {invitation.status}</p>
    {(actionable || invitation.status === "Expired") && <p><strong>{actionable ? "Expires" : "Expired"}:</strong> {invitation.expiration}</p>}
    <div><InvitationInfo label="About organization membership">Organization membership and Client assignments are separate. A Client team manager must assign you before you can view a Client.</InvitationInfo></div>
    {administrator && actionable && <p className="form-helper-text">Accepting grants {invitation.membershipRole === "MEMBER" ? "organization membership" : "organization administration"}. It does not assign Clients.</p>}
    {!administrator && !actionable && invitation.status !== "Accepted" && <p className="form-helper-text">This link no longer grants membership. Ask your organization administrator for the latest invitation.</p>}
    {administrator && invitation.status !== "Accepted" && invitation.membershipRole !== "OWNER" && <>
      <label className={styles.confirm}><input type="checkbox" name="replaceConfirmed" value="yes" checked={replacement} onChange={event => setReplacement(event.target.checked)} />Replace previous unused links. They will stop working.</label>
      <div className={styles.actions}>
        <button name="decision" value="reissue" className="auth-button" disabled={pending || !replacement} aria-busy={pending}>{pending ? "Processing…" : "Reissue Link"}</button>
        {actionable && <button name="decision" value="revoke" className="auth-button" disabled={pending} aria-busy={pending}>Revoke Invitation</button>}
      </div>
    </>}
    {administrator && <>
      {actionable && invitation.membershipRole !== "OWNER" && <>
        <button type="button" className="soft-link" onClick={() => setCorrecting(value => !value)} aria-expanded={correcting}>Correct Recipient Email</button>
        {correcting && <div className="auth-form" data-swipe-ignore="true">
          <label htmlFor={`${linkId}-correction`}>Correct recipient email</label>
          <input id={`${linkId}-correction`} type="email" name="correctedEmail" value={correctedEmail} onChange={event => setCorrectedEmail(event.target.value)} />
          <p>Revoke the invitation to {invitation.email} and issue a new invitation to the corrected address. Existing accounts and memberships will not be changed.</p>
          <label className={styles.confirm}><input type="checkbox" name="correctionConfirmed" value="yes" checked={correctionConfirmed} onChange={event => setCorrectionConfirmed(event.target.checked)} />I confirm the corrected address. The incorrect link and previous unused links for the corrected address will stop working.</label>
          <button className="auth-button" name="decision" value="correct" disabled={pending || !correctionConfirmed || !correctedEmail.trim()} aria-busy={pending}>Revoke and Issue Corrected Invitation</button>
        </div>}
      </>}
      <InvitationResult state={onIssued ? { ...state, invitationPath: undefined } : state} pending={pending} />
    </>}
    {!administrator && !actionable && <InvitationResult state={state} />}
  </form>;
}
