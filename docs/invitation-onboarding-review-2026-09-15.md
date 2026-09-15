# Invitation/onboarding repair review — September 15, 2026

Local changes are ready for review, with the limitations below. Nothing was committed or deployed. No hosted invitations, accounts, memberships, credentials, roles, Client assignments, or schema were changed. This report supersedes the earlier incomplete investigation in this file.

## Confirmed facts and provenance

The user’s Preview is `https://aut-connect-jkdypnh2u-marina-s-projects-35c7f917.vercel.app`. Vercel reports it Ready, and native Chrome inspection found its dashboard already signed in as Lucas. Eight targeted deployment source artifacts (signup, login, invitation actions/service, auth pages and Prisma schema) matched the pre-repair local files byte for byte. A newer Preview also exists; that does not establish which code the user tested.

Read-only transactions against the database referenced by the existing local Vercel-backup configuration found Lucas registered as **lucas.hayes@example.com**, an active Behavior Therapist. The initial account check found no organization membership or Client assignment. A second query included *all* Bright Path Agency invitations, correcting the earlier query’s omission of invitations that did not match Lucas’s registered email.

| Recipient | Created (UTC) | Observed lifecycle |
| --- | --- | --- |
| lucas.hayes@exqmple.com | 2026-09-15 14:55:35.733 | Pending; expires September 22 |
| lucas.hayes@exqmple.com | 2026-09-15 13:39:53.950 | Replaced; revoked September 15 at 14:55:35.456 |
| lucas.hayes@example.com | 2026-09-14 09:14:05.082 | Pending; expires September 21 |
| nora.bennett@example.com | 2026-09-13 | Accepted owner invitation |

These are exact synthetic account/recipient emails requested for diagnosis; no invitation secret, password, raw record ID, connection string or clinical text was logged. Queries used READ ONLY and ROLLBACK.

**Database-binding limit:** the local backup database has not been conclusively bound to this exact deployment. A narrowly scoped Vercel configuration check found one unbranched Preview DATABASE_URL setting, unchanged since before deployment, but its value was unavailable for equality comparison. This is missing evidence, not proof of a mismatch. No unrelated environment variables were downloaded for this check.

The typo is confirmed in the checked database. An invitation addressed to `exqmple.com` cannot authorize the registered `example.com` account. The exact secret originally used by Lucas was not observed, so it remains unproven which invitation caused his particular rejection.

## Confirmed implementation defects

- Signup validation and existing-account error redirects discarded invitation context. A synthetic invocation of the matching deployed action reproduced this without writes or a session. The direct signup Login link already retained the token, so this defect alone does not explain a direct Login-link attempt.
- Accepted invitations were excluded by the acceptance lookup, making safe retries fail. Generic exception handling also obscured validation versus transaction failures.
- The inspected deployed no-Client dashboard had no recipient staff-invitation inbox. Its other organization invitation destination concerned organizations joining Clients, a different workflow.
- The invitation administration UI lacked a persistent separation of current invitations, active members and history. Nested bounded card scrolling could move feedback away from its action; this is an implementation risk, not a recorded explanation of Lucas’s original screen.
- During isolated rendered testing, React’s native form reset visually reset the selected role after successful issuance. The invitation forms now retain their input state and explicitly clear confirmation checkboxes on success.

## Focused local changes

1. Preserve invitation context through signup/OAuth errors and password-login recovery. Keep token hashing, persisted active-account checks, recipient/role matching, lifecycle checks, and existing organization administration scope. Accepted-link retries acknowledge an existing active membership without duplicates or elevation; removed access cannot be restored by an accepted link.
2. Reuse the existing Inbox/More and no-Client empty state for My Organization Invitations. Keep personal invitations discoverable independently of Client assignments. Existing Client organization and Client-team management checks remain separate.
3. Separate pending invitations, creation, active members and collapsed history using shared administrative cards. Show recipient, organization, role, status and actionable expiry. Freshly issued links remain visible in one Ready to Copy card even when the old invitation moves to history.
4. Provide one Copy Link action, immediate pending/copied feedback, and a selectable read-only field with explicit manual-copy fallback. State that no email was sent. The generated path and secret are copied unchanged; the current browser origin supplies the expected hostname.
5. Add a confirmed correction action to the existing invitation-management transaction: revoke unused incorrect-address invitations and prior unused correct-address invitations, then issue one new invitation to the corrected address. Warn that earlier links stop working. Do not edit either account or create membership. Same-address requests are directed to reissue instead.
6. Put input, validation, processing feedback and Accept/Decline together at the top of the recipient card. Explain ordinary login URLs specifically. Explain recipient mismatch without disclosing the other account. Hide stale validation when the input changes, and show a joined-organization result after acceptance.
7. Preserve the link-secret requirement: an email or invitation ID alone is not sufficient. No new authorization layer, schema migration, public deployment, animation redesign or history-listener repair was introduced.

## Shared design and necessary departures

Reused `AdministrativeCarousel`, its theme/card styles and `useGuardedSwipe`, `ChevronControl`, `MaterialSelect`, `InvitationInfo`, auth status/button/input styles, and existing Dashboard Inbox/More entry points.

The shared carousel gained a records mode retaining selection by record ID. Zero records render no misleading controls; a single record has no chevrons/count. Invitation pages opt into page scrolling instead of a nested maximum-height card so feedback remains reachable. Other carousel modes retain their scrolling behavior. New CSS is limited to wrapping, action sizing and disclosure/feedback placement using existing treatments. Inputs, links and action groups use existing swipe safeguards. Optional information uses the accessible click/keyboard disclosure pattern.

## Executed verification

- **208/208 tests passed**: dashboard/shared administrative contracts and rendered React components, invitation service/action fixtures, invitation policy, Client-team authorization policy and authorization scopes.
- **7/7 isolated PostgreSQL integration tests passed**, using actual Prisma schema, services and actions: ordinary login URL; typo recipient; confirmed atomic correction; replaced/expired/revoked rejection; valid existing-user and repeated acceptance; unauthorized management rejection. Old links pasted into the current invitation card receive lifecycle feedback. Account data stays unchanged and Client access is not granted.
- Clipboard tests compare the exact value sent to the writer and test denied-write manual-copy feedback.
- TypeScript `--noEmit --incremental false` and targeted ESLint passed after final changes. No successful build is used as proof of the workflow.

Four previously failing UI contracts were reconciled against intended behavior: restored Case Support’s established first position; asserted personal-inbox discoverability independently of organization administration; retained separate Case Support/Client-organization authority conditions; and moved same-card creation assertions to the new administration composition while checking fresh-link feedback, history separation and retained component state. Security assertions were not deleted to make the suite pass.

### Actual browser walkthrough

A separate loopback Next application copy used a newly initialized, password-protected PostgreSQL 15 test cluster. It had no project environment files, hosted database, Google OAuth or external AI enabled. Original build files and running servers were preserved. Only synthetic fixtures were mutated.

Native Chrome performed real owner login, invitation issuance, Copy Link, real recipient login, inbox discovery without Clients, ordinary-login-URL rejection, then acceptance of the copied invitation. The displayed and clipboard URLs compared equal in memory, with a complete `/create-account` invitation path and token. Pasting the copied value into the recipient field compared equal again. No secret appeared in output.

The browser displayed “You’ve joined Synthetic UI Agency. Your Client assignments are managed separately.” A database read-back confirmed **one membership, one accepted invitation, zero Client assignments**. Thus the successful browser test includes real session login, server actions and persistence, not only mocked rendering.

| Rendered coverage | Result / limit |
| --- | --- |
| Desktop Chrome, light and dark | Recipient validation beside input/action; joined result verified |
| Responsive desktop Chrome, 390 × 844, light and dark | Input, specific error and actions visible together; no observed horizontal clipping |
| Administrator create/copy | Actual shared card, manual-delivery message and copied feedback verified |
| Actual clipboard-denied browser permission | Not induced; fallback verified by unit test |
| Tablet, enlarged text, long organization/email stress cases | Not visually completed; remains review coverage |
| Multi-record physical swipe, keyboard-open phone behavior | Not physically tested; shared safeguards and rendered counts tested |
| Physical iPhone / Safari Web Inspector | No coverage; desktop emulation is not a physical-device test |
| Final small copy-pending/stale-error/reset refinements | TypeScript, lint and regression tests; full browser walkthrough preceded these final refinements |

## Browser warning — separate finding

The supplied Preview was inspectable through native Chrome even though browser-extension tab access was unavailable. It was already signed in. The current site-information popup said “Connection is secure”; no red Dangerous label was present during inspection. **This does not classify or dismiss the earlier Safe Browsing warning.** Its earlier classification remains unresolved. No warning was bypassed, no security settings changed, no private invitation URL submitted to a scanner, and no credentials or invitation secrets entered on the hosted Preview.

## Verified walkthrough and next action

Verified in the isolated application: administrator uses existing More → Invite Team → Create Invitation, checks the recipient and role, creates and copies the fresh link; recipient signs in normally → My Organization Invitations, pastes the complete copied link and accepts; the joined message appears, with no Client access granted. Explicit Client assignment remains a separate authorized action.

For a typo, the local correction UI requires the administrator to enter the corrected email and confirm revocation/replacement before issuing the new link. This correction transaction was tested against isolated PostgreSQL; it has not been performed on Bright Path’s hosted records.

Smallest next action: review the local patch, finish the remaining tablet/physical interaction checks, and establish the exact Preview/database binding and earlier warning classification before a hosted acceptance walkthrough. Any hosted correction should target the confirmed incorrect invitation, explicitly use `lucas.hayes@example.com`, and disclose replacement of the already-pending correct-address link. Do not ask Lucas to repeat an unchanged failing flow.

Local evidence supports this focused repair, not a claim that the hosted workflow is fixed. Commit, deployment, and changes to Bright Path invitations each remain subject to the user’s specific approval.
