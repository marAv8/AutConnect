# AutConnect code and UI map

This document describes where the current application behavior lives. It is a
navigation aid, not a proposal to change the interface.

## File formats

- `.ts` contains TypeScript without React markup.
- `.tsx` contains TypeScript with React components.
- `.css` and `.module.css` contain global and component-scoped styles.
- `.cjs` is JavaScript using the CommonJS module format. AutConnect uses `.cjs`
  primarily for tests that run directly with Node's test runner. These files
  are expected and should not be renamed without migrating the test setup.

## Dashboard ownership

### Server data composition

- `app/dashboard/page.tsx` authenticates the user, loads authorized client data,
  signals, Team Focus, and Case Support state, and chooses the supervisor or
  provider dashboard.
- `app/dashboard/dashboardClientTypes.ts` defines the dashboard read model shared
  by the server page and client components.

### Role-specific controllers

- `app/dashboard/SupervisorDashboard.tsx` owns supervisor dashboard state,
  client assignment modes, Insights, and supervisor actions.
- `app/dashboard/ProviderDashboard.tsx` owns the service-provider and caretaker
  dashboard state.
- `app/dashboard/SupervisorDashboardMenu.tsx` is the active supervisor action
  menu. There is no second dashboard menu implementation.

### Shared dashboard layout

- `app/dashboard/DashboardWorkspaceLayout.tsx` provides the shared dashboard
  frame.
- `app/dashboard/GridClientView.tsx` owns the client-list presentation.
- `app/dashboard/OrbitView.tsx` connects a selected client to the carousel/orbit
  presentation.
- `app/dashboard/ModeContentFrame.tsx` provides the shared mode transition frame.

### Client carousel and provider orbit

- `app/dashboard/ClientCarousel.tsx` owns selected-client navigation and which
  client-level overlay is open.
- `app/dashboard/ClientCarouselNavigation.tsx` owns the previous/next client
  controls and position count.
- `app/dashboard/ClientCarouselSlide.tsx` owns the visible client slide frame.
- `app/dashboard/ClientOrbit.tsx` renders client and provider badges and their
  action controls.
- `app/dashboard/clientOrbitLayout.ts` contains deterministic provider placement
  calculations.
- `app/dashboard/clientOrbitCompletion.ts` contains completion-state projection.
- `app/dashboard/clientCarouselModel.ts` contains read-state and saved-entry
  projections that do not require React.
- `app/dashboard/providerSignalState.ts` contains provider-signal presentation
  state.

## Dashboard overlays

- `DashboardNoteOverlay.tsx`: loads and presents provider note forms/history.
- `DashboardClientHandoffOverlay.tsx`: presents current and previous Client
  Summary information.
- `DashboardTeamFocusOverlay.tsx`: edits Team Focus.
- `DashboardAbcDataOverlay.tsx`: records A-B-C data.
- `InsightsOverlay.tsx`: presents the five supervisor-only Insights lenses.
- `DashboardProductGuide.tsx`: presents the product guide.

Overlay history and opening/closing coordination currently belong to
`ClientCarousel.tsx`. Visual unification of overlay shells should happen during
the UI pass, after the one-client workflow is verified.

## Shared interaction primitives

- `components/ui/ChevronControl.tsx` is the single previous/next chevron
  component. Its `carousel` and `raised` treatments are styled in
  `app/globals.css`.
- `components/useGuardedSwipe.ts` is the shared horizontal gesture hook. It
  chooses an axis, preserves vertical scrolling, ignores interactive controls,
  handles pointer capture, and prevents the click that can follow a completed
  swipe.
- `components/ui/OverlayContainer.tsx` is used by the note entry/history
  overlays. Other dashboard dialogs still have local shells and should be
  compared during the UI pass before any consolidation.
- `components/ContextualHelp.tsx` owns contextual information/help disclosure.

## Documentation workflow

- `app/portal/notes/add/EntryForm.tsx` is the main orchestration component for
  provider documentation. It remains large and should not be split until the
  complete one-client cycle establishes a stable behavioral baseline.
- `entryFormConfig.ts` contains profession and target configuration.
- `entryFormClinicalModel.ts` contains clinical presentation calculations.
- `entryFormDraftModel.ts` contains draft serialization and restoration.
- `entryFormHelpers.ts` contains formatting and small deterministic helpers.
- `useEntrySubmit.ts` owns submission coordination.
- `EntrySpecializedForms.tsx` and `ObservationEntryForm.tsx` contain specialized
  workflow presentations.
- `NoteOverlay.tsx` provides the note-entry overlay shell.

## Note history

- `NoteHistoryViewer.tsx` coordinates note navigation and display.
- `NoteHistorySections.tsx` contains the collapsible evidence sections.
- `noteHistoryModel.ts` transforms records for presentation.
- `noteHistoryRevision.ts` handles revision-history presentation.
- `noteHistoryTypes.ts` is the shared read contract.

## Supervisor-only subsystems

- `app/portal/supervisor/field-observation/` owns Field Observation UI.
- `src/lib/fieldObservation.ts` contains deterministic rubric and coverage rules.
- `src/lib/fieldObservationPersistence.ts` contains persistence preparation.
- `app/api/insights/` owns the Insights context, snapshot, question guards, and
  optional synthesis boundary.
- `app/libs/mastery/` owns native criterion and mastery-candidate policy.

## Organization and platform access

- `app/platform/` contains platform-administrator organization approval and
  management pages.
- `app/portal/supervisor/invitations/` contains organization invitations.
- `src/lib/authorization.ts`, `authorizationScope.ts`, and related policy files
  define server-side boundaries. UI visibility must not replace these checks.

## Files to treat carefully during the UI pass

The following files are large because they coordinate many established
interactions. Size alone is not a reason to split them:

1. `EntryForm.tsx` — documentation state and multiple profession workflows.
2. `ClientOrbit.tsx` — badge animation, signals, action controls, and completion.
3. `SupervisorDashboard.tsx` — dashboard modes, history, and overlays.
4. `ClientCarousel.tsx` — client navigation and overlay history.
5. `InsightsOverlay.tsx` — finding cards, sources, provider groups, and lens UI.

Extract from these files only when a responsibility has a stable input/output
boundary and focused tests can protect the move.

## One-client cycle before visual changes

Run one client through this order for each applicable role:

1. Open the client from grid and orbit views.
2. Open every provider badge and return without losing client position.
3. Create or update morning and evening caretaker context.
4. Create, revise, complete, and view provider documentation.
5. Verify unread signals and their clearing behavior.
6. Open current and previous Client Summary.
7. Create, view, revise, and expire Team Focus.
8. Open all five Insights lenses and every available source disclosure.
9. Complete a Field Observation and return to the same client.
10. Exercise Case Support entry points for authorized roles.
11. Repeat navigation with touch, mouse, keyboard, narrow viewport, and desktop
    viewport before changing gesture thresholds or visual treatments.

Record behavioral problems separately from visual inconsistencies. Gesture,
layout, and styling changes should begin only after the workflow baseline is
recorded.
