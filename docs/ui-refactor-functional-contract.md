# UI refactor functional contract

This is the behavioral boundary for the responsive AutConnect UI refactor. It
protects application behavior; it is intentionally not a visual snapshot or a
record of current measurements.

## Preserved contracts and ownership

| # | Behavior that must remain unchanged | Responsible source modules | Automated protection |
|---|---|---|---|
| 1 | One canonical Entry exists per Provider, Client, calendar day, and kind; later saves update that Entry. | `prisma/schema.prisma` (`Entry` compound unique), `app/actions/createEntry.ts`, `app/actions/updateOwnEntry.ts`, `app/libs/documentationDay.ts` | `app/actions/__tests__/entryAuthorization.test.cjs`, `app/libs/__tests__/entryLifecycle.test.cjs` |
| 2 | Entry update responses, status, and before/after revision history remain stable. | `app/actions/updateOwnEntry.ts`, `app/actions/completeSessionNote.ts`, `app/libs/entryRevision.ts`, `app/libs/entryLifecycle.ts` | `app/actions/__tests__/entryAuthorization.test.cjs`, `app/libs/__tests__/entryRevision.test.cjs`, `app/portal/notes/view/__tests__/noteHistoryRevision.test.cjs` |
| 3 | View Notes includes the current day and six preceding calendar days and may show previous-day entries. | `app/libs/documentationDay.ts`, `app/portal/notes/view/page.tsx`, `app/api/notes/history/route.ts`, `app/portal/notes/view/noteHistoryModel.ts` | `app/dashboard/__tests__/clientCarouselModel.test.cjs`, `app/dashboard/__tests__/uiRefactorFunctionalContract.test.cjs`, `app/portal/notes/view/__tests__/noteHistoryModel.test.cjs` |
| 4 | Only active assignees can load Client entries; an active assigned Provider can read shared entries and their own private entries. | `src/lib/authorization.ts`, `src/lib/clientTeamAuthorizationPolicy.ts`, `app/dashboard/page.tsx`, `app/libs/noteFormData.ts`, note history page and route | `app/actions/__tests__/entryAuthorization.test.cjs`, `src/lib/__tests__/clientTeamAuthorizationPolicy.test.cjs`, `app/dashboard/__tests__/uiRefactorFunctionalContract.test.cjs` |
| 5 | Unassigned and revoked Providers are excluded from dashboard discovery and all Client-scoped direct entry points, including notes, measurements/goals, observations, Team Focus, Insights, and Case Support. | `src/lib/authorization.ts`, `src/lib/authorizationScope.ts`, `src/lib/clientTeamAuthorization.ts`, Client-scoped pages/routes, and their server actions | `app/actions/__tests__/clientTeamPhase2.test.cjs` (including the application-wide revoked-assignment scan), `app/actions/__tests__/entryAuthorization.test.cjs`, `app/api/insights/__tests__/insightsAuthorization.test.cjs`, `app/api/insights/__tests__/insightSnapshotRoute.test.cjs`, `src/lib/__tests__/fieldObservationPersistence.test.cjs`, Case Support tests |
| 6 | Author publication confirmation, author same-day view/update availability, and teammate unread signals are separate states. Intermediate saves do not announce publication; successful final completion announces once. A save acknowledges the author immediately; teammates retain their existing read state until they view; one viewer cannot acknowledge another; day rollover restores the new-day action. | `EntryRead` in `prisma/schema.prisma`; `app/libs/entryReadState.ts`; `app/dashboard/clientCarouselModel.ts`; `app/dashboard/providerSignalState.ts`; `app/dashboard/ClientCarousel.tsx`; `app/dashboard/ClientOrbit.tsx`; `app/dashboard/notePublicationFeedback.ts`; `app/libs/documentationDay.ts` | `app/libs/__tests__/entryReadState.test.cjs`, `app/actions/__tests__/entryAuthorization.test.cjs`, `app/dashboard/__tests__/clientCarouselModel.test.cjs`, `app/dashboard/__tests__/clientOrbitCompletion.test.cjs`, `app/dashboard/__tests__/notePublicationFeedback.test.cjs`, `app/dashboard/__tests__/uiRefactorFunctionalContract.test.cjs` |
| 7 | Mastered goals leave active target selection but remain stored and available to historical Entries and revision/history views. | `app/libs/noteFormData.ts`, `app/actions/removeGoalDefinition.ts`, `app/libs/mastery/`, `GoalDefinition` and `AssessmentItem` in the Prisma schema | `app/actions/__tests__/entryAuthorization.test.cjs`, all `app/libs/mastery/__tests__/*.test.cjs`, `src/lib/__tests__/clientTeamAuthorizationPolicy.test.cjs` |
| 8 | Selected Client identity and carousel/orbit state survive dashboard navigation and Client-scoped return links. | `app/dashboard/ProviderDashboard.tsx`, `app/dashboard/SupervisorDashboard.tsx`, `app/dashboard/ClientCarousel.tsx`, Client-scoped portal return links | `app/dashboard/__tests__/uiRefactorFunctionalContract.test.cjs`, `src/lib/__tests__/fieldObservation.test.cjs` |
| 9 | Utility actions remain available only to their established roles (including supervisor administration/Insights/Team Focus/Field Observation, provider documentation and Case Support, and caregiver context). | `app/dashboard/ClientOrbit.tsx`, `app/dashboard/SupervisorDashboardMenu.tsx`, `app/dashboard/ProviderDashboard.tsx`, `app/components/AuthenticatedPageHeader.tsx`, Case Support pages | `app/dashboard/__tests__/dashboardUtilityDock.test.cjs`, `app/dashboard/__tests__/insightsOverlay.test.cjs`, `app/dashboard/__tests__/clientOrbitCompletion.test.cjs`, `app/components/__tests__/authenticatedPageHeader.test.cjs`, Case Support tests |
| 10 | Organization invitations, Client organizations, provider assignments, soft revocation, Attach Existing Client, minimal disclosure, and duplicate prevention retain their present authorization and transaction policies. | `app/actions/manageClientTeam.ts`, `app/actions/manageOrganizationInvitations.ts`, `app/actions/manageClientAttachRequests.ts`, `src/lib/clientAttachPolicy.ts`, `src/lib/clientTeamAuthorizationPolicy.ts`, `src/lib/invitationPolicy.ts`, related schema constraints | `app/actions/__tests__/clientTeamFoundation.test.cjs`, `app/actions/__tests__/clientTeamPhase2.test.cjs`, `src/lib/__tests__/clientAttachPolicy.test.cjs`, `src/lib/__tests__/clientTeamAuthorizationPolicy.test.cjs`, `src/lib/__tests__/invitationPolicy.test.cjs`, `app/portal/organization/attach-client/__tests__/phase3bUi.test.cjs` |
| 11 | Light/dark selection changes only local presentation state and never application data, session state, or authorization. | `app/components/ThemeToggle.tsx`, `app/layout.tsx`, theme selectors in presentation styles | `app/dashboard/__tests__/uiRefactorFunctionalContract.test.cjs` |
| 12 | Mutation controls expose an in-flight state and canonical/transactional server boundaries prevent silent duplicate writes. | Entry forms, invitation/attach/client-team action controls, Entry compound unique constraint, organization/attach uniqueness and serializable actions | `app/dashboard/__tests__/uiRefactorFunctionalContract.test.cjs`, `app/actions/__tests__/entryAuthorization.test.cjs`, `app/actions/__tests__/clientTeamPhase2.test.cjs`, `src/lib/__tests__/clientAttachPolicy.test.cjs` |

## Author confirmation and teammate unread state

These concepts must remain independent during responsive work:

- **Publication confirmation** is one brief, accessible “Note published” message
  after the final completion server action succeeds. Target saves, autosaves,
  intermediate sections, draft updates, and post-publication updates do not
  produce a global success message. Publication feedback is not an unread
  signal and does not change Client identity or navigation.
- **Same-day author action** remains available after confirmation and after
  viewing. When today's canonical Entry exists, the author sees “View or update
  today's note” and the existing edit workflow; the plus/Add Note state returns
  only when no canonical Entry exists for the active day.
- **Teammate unread signal** is backed by that viewing Provider's `EntryRead`.
  Author saves never reset a teammate timestamp, and viewing one author's Entry
  never acknowledges another author.

## Manual-only checks

The following checks remain manual because they require rendered interaction or
real authorization state and must not be replaced by screenshots:

- Run the one-Client cycle in `docs/code-and-ui-map.md` for every applicable
  role using mouse, keyboard, touch, narrow viewport, and desktop viewport.
- Confirm each role's visible utility actions and all direct-URL denial paths
  against controlled local accounts, including revoked assignments.
- Exercise browser Back/Forward through grid, orbit, overlays, notes, Field
  Observation, and Case Support, confirming the same Client remains selected.
- Toggle light/dark mode across reloads and confirm no clinical, assignment, or
  unread data changes.
- Rapidly activate each high-value submit control in a safe disposable local
  environment and confirm only one request/write is accepted. Do not use a
  database-writing Playwright run for this safety phase.

## Strict ownership boundary

Future responsive work may change layout, styling, markup wrappers, component
composition, transitions, and presentation state. It may not change
authorization, database writes, server-action inputs or outputs, Entry
processing, signal logic, unread logic, goal lifecycle, or historical data
behavior without separate review.

Presentation code may derive display-only state and forward existing typed
inputs. It must not broaden Client discovery, infer authorization from a visible
control, reshape server-action payloads or responses, introduce database
writes, acknowledge unread records, complete Entries, alter signals, or mutate
goal/history state. Functional/server modules and Prisma remain outside the UI
refactor ownership boundary.
