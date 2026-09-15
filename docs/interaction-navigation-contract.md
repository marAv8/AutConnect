# Interaction and navigation contract

## Purpose and boundary

This is a read-only source audit prepared before the shared responsive shell. It
describes current ownership, confirmed defects, authorization boundaries, and
the smallest safe implementation slice. It does not redefine note creation,
publication, updating, signaling, or View Notes; those workflows have passed
manual acceptance and are out of scope.

The future shell may change layout and presentation, but it must not infer an
authorization capability from a Provider role, bypass an existing server-side
check, broaden Provider discovery, or discard the selected Client when moving
between the dashboard and a Client feature.

## 1. Confirmed cause of More-menu double activation

The dashboard More menu is rendered by
`app/dashboard/SupervisorDashboardMenu.tsx` and owned by
`app/dashboard/SupervisorDashboard.tsx`.

Confirmed from source:

- The trigger is one native `button` with one React `onClick`. There are no
  touch, mouse, capture-phase, or duplicate click handlers on it. Source does
  not support a touch-plus-synthetic-click explanation.
- `menuOpen` is React state in `SupervisorDashboard`. Opening calls
  `history.pushState` with an `autConnectDashboardLayer` whose `menuOpen` is
  true, then synchronously sets React state.
- The menu panel and trigger share `menuRef`. The window `pointerdown` listener
  closes only when the event target is outside that ref, so a trigger event does
  not also execute the outside-close branch.
- There is no dashboard More-menu backdrop. The transparent menu panel and its
  reveal styling do not create a source-visible invisible hit target over the
  trigger.
- Trigger close, outside pointer-down, and Escape all call
  `closeDashboardMenu`. When the current history state says the menu is open,
  that function calls `history.back()` and returns without synchronously setting
  `menuOpen` false. The UI therefore waits for the asynchronous `popstate`
  handler to close.
- A second interaction before `popstate` is applied still sees an open menu and
  can request another `history.back()`. This history/state race is the confirmed
  structural cause of delayed close and can also consume more than the menu
  layer. It explains why a later tap appears to be the effective close. The
  precise device timing behind every observed second/third-tap sequence remains
  a live-reproduction question.
- Opening the menu creates a browser-history entry even though the menu is
  temporary presentation state. Closing is therefore coupled to navigation,
  contrary to the intended contract.
- Most menu actions call the parent's `onClose`, which replaces the current
  dashboard history state with `menuOpen: false`, then navigate or change mode.
  **Add Client is the exception:** its `Link` has no `onClick={onClose}`. Remove
  Client and Insights replace the menu layer with their next dashboard state;
  Guide replaces the menu layer before opening its local state.

No duplicate dashboard More component or second dashboard More listener was
found. Provider dashboards do not mount this menu.

Universal menu contract for implementation:

- One tap opens; one subsequent trigger tap closes.
- One outside pointer/tap closes; Escape closes.
- One action activation closes and navigates exactly once.
- Touch must not cause synthetic double activation.
- Closing a temporary menu must not add, consume, or otherwise mutate browser
  history.

## 2. Utility-menu ownership map

| Surface | Trigger/menu/outside layer | State and handlers | History/action behavior |
| --- | --- | --- | --- |
| Supervisor dashboard More | `SupervisorDashboardMenu.tsx`; native ellipsis button; conditional `.dashboard-more-menu`; no backdrop; window outside `pointerdown` and `keydown` installed by `SupervisorDashboard.tsx` | Parent `menuOpen`; trigger `onClick`; window bubbling `pointerdown`; Escape | Incorrectly pushes a dashboard history layer. Close waits for `popstate`. Most actions replace the layer; Add Client does not explicitly close. |
| Provider/author documentation action menu | `app/dashboard/ClientOrbit.tsx`; orbit action button; portal-mounted `[role=menu]`; full-screen `.provider-action-menu-backdrop` | `menuProviderId` and menu-mode/closing state; window outside `pointerdown`; Escape; backdrop click; panel/backdrop stop pointer down/up/click; close animation timers | No browser-history entry. The backdrop intentionally owns the first outside click and delayed dismissal supplies animation. Action helpers close then invoke one callback. This is separate from the reported More defect. |
| Contextual Help | `components/ContextualHelp.tsx`; local popover and document `pointerdown` | Local `open`; containment check; immediate state close | No history. |
| Care Team information | `app/portal/supervisor/edit-providers/[clientId]/CareTeamInfo.tsx` | Local `open`; document `pointerdown`; immediate state close | No history. |
| Organization Invitation information | `app/portal/organization/client-invitations/InvitationInfo.tsx` | Local `open`; document `pointerdown`; immediate state close | No history. |
| Theme, Team Focus, Case Support utility controls | Dashboard menu/layout components | Independent action/control state; not More-menu owners | Must not be folded into More state or acquire incidental history behavior. |

The Provider note menu's closing animation (roughly 180–220 ms) may be worth a
separate tactile check, but it is not evidence for the dashboard's reported
second/third-tap defect.

## 3. Route/layer and Back matrix

Conceptual order is: Client list (layer 1) -> selected Client orbit (layer 2) ->
Client feature route (layer 3) -> temporary menu/dialog/popover/overlay (layer
4). A Back control should remove exactly its current conceptual layer.

| Start/control | Current implementation and destination | One layer? Client/URL preservation | Direct URL and browser Back |
| --- | --- | --- | --- |
| Dashboard Client list -> orbit | Supervisor `pushDashboardLayer`; Provider `openClientOrbit`; pushes `/dashboard?clientId=…&view=orbit` | Yes. Selected Client is encoded. Carousel changes replace only the current orbit URL with the new Client. | Dashboard page accepts orbit only when `clientId` is in the assigned Client set; otherwise it stays at grid. A valid direct orbit URL is initialized as grid then orbit, so browser Back reaches grid. |
| Orbit -> Client List button | Both dashboard controllers call `history.replaceState` and set grid | **No.** It visually reaches grid, but replaces the orbit entry while the earlier grid entry remains underneath. This produces adjacent duplicate `/dashboard` entries, so subsequent browser Back can look like a no-op/repeated activation. Active Client remains only in history state, not the grid URL. | Browser Forward/Back semantics are weakened because the orbit entry was destroyed instead of consumed. Likely source of repeated Back behavior. |
| Supervisor More close | `history.back()` when `menuOpen` is in the dashboard history state | Intended to remove one temporary layer, but incorrectly mixes menu dismissal and navigation and waits for `popstate`; rapid interactions can consume extra layers | Browser Back closes it because opening pushed it, but temporary-menu history is outside the intended contract. |
| Remove Client view -> Client List | `returnOneDashboardLayer`; normally `history.back()`, otherwise replaces grid | Usually one dashboard layer. No feature route. | Direct/fallback state replaces grid. |
| Insights overlay -> orbit | `returnOneDashboardLayer`; normally `history.back()` | Usually one layer and preserves `activeClientId` | It is stored in the supervisor dashboard history layer, unlike local popovers. |
| Carousel note/progress overlay -> orbit | `ClientCarousel.tsx` pushes `autConnectDashboardOverlay` at the same URL. Close immediately clears UI, marks closing, then calls `history.back()`; guarded `popstate` completes it | Yes in the normal path; selected Client and orbit URL remain | Browser Back closes the overlay. This is the strongest existing model for synchronously removing a history-backed conceptual layer. |
| Note Add/View -> orbit | `NoteOverlay.tsx` and `NoteHistoryViewer.tsx` link to `/dashboard?clientId=…&view=orbit`; their internal overlays close locally | Feature -> selected orbit; identity is preserved | Direct feature URL has a deterministic explicit destination rather than depending on prior history. Browser Back follows the actual entry stack. |
| Case Support Client/request -> orbit | Both page routes link or redirect to `/dashboard?clientId=…&view=orbit` | Feature -> selected orbit; identity preserved | Direct URL retains a deterministic return. `CaseSupportSuccessToast` only removes its success query state with `replaceState`. |
| Field Observation -> orbit | Form uses a Client-specific dashboard href and `router.push` after success | Feature -> selected orbit; identity preserved | Entry route authorization handles direct access; browser Back remains stack-dependent. |
| Care Team Client detail -> Care Team list | Detail page Back targets `/portal/supervisor/edit-providers`; list Back targets `/dashboard` | One conceptual detail/list layer, but list -> dashboard loses selected Client/orbit state | Direct detail still has deterministic list destination. Browser Back may differ from the explicit control. |
| Create Client, Attach Existing Client, Invite Team, Organization Invitations -> dashboard | Hard-coded `Link href="/dashboard"` | Returns directly to Client list and does not preserve a selected Client | Deterministic for direct URLs, but skips selected orbit if launched from one. |
| Case Support requests inbox -> dashboard | Native `<a href="/dashboard">` | Hard reload; loses selected Client and dashboard history state | Deterministic but discards SPA/history/scroll state. |
| Platform Administration child -> platform -> dashboard | Children link to `/platform`; platform root links to `/dashboard` | Appropriate admin hierarchy, but dashboard selection is not preserved | Direct URL behavior is deterministic. |
| ClientOrbit feature actions | `router.push` for Case Support/Field Observation; note callbacks open carousel overlays | One action invocation in source; Client ID is included | Browser Back returns according to actual stack; explicit feature Back is safer. |

No explicit scroll-restoration owner was found for dashboard grid/orbit changes.
Native history mutation changes URL and component state but does not store grid
scroll. Hard reloads necessarily discard component state. Redirects are used for
authentication/authorization and successful server workflows; they should not
be repurposed as layer Back behavior.

## 4. Administrative capability matrix

`app/dashboard/page.tsx` passes the Supervisor menu only
`canAccessPlatformAdministration`, derived from the platform-admin email policy.
It does not pass direct organization-admin or Client Team Manager capabilities.
Consequently, grid actions other than platform Administration are rendered from
Supervisor mode/role, not their actual capabilities.

| Action | UI visibility | Server authorization | Agreement / ordinary Supervisor result |
| --- | --- | --- | --- |
| Administration | Supervisor menu plus `isPlatformAdminEmail` capability | Active Provider and platform-admin email (`requirePlatformAdmin`) | Aligned. Ordinary Supervisor does not see it. |
| Invite Team | Every Supervisor in grid mode | Active Supervisor plus direct, active `OWNER`/`ADMIN` organization membership (`getManagedOrganizationIds`) | Mismatch. Ordinary Supervisor can see the link, then has no eligible managed organization / is rejected. No district inheritance. |
| Add Client | Every Supervisor in grid mode | Active Supervisor plus direct administration of the selected responsible organization; selected Providers must be active, non-Supervisor members of that organization | Mismatch. Ordinary Supervisor can see an unusable/rejected action. Created Client gets an active `LEAD` organization, creator assignment, and creator Team Manager grant. |
| Attach Existing Client | Every Supervisor in grid mode; header also exposes it when direct org-admin capability exists | Active Provider with direct, active `OWNER`/`ADMIN` membership in the requesting organization; later approval also requires Client authority | More-menu mismatch for ordinary Supervisors. Header predicate is aligned and also correctly supports qualified non-Supervisors. District/parent relationships do not confer authority. |
| Organization Invitations | Header only when a direct active `OWNER`/`ADMIN` membership exists | Same exact-organization membership is required to view/approve/reject | Aligned. This is capability-based rather than Supervisor-role-based. |
| Link Client | Dormant `AddClientView.tsx` exists but no mounted route/menu use was found | `addSupervisorClient` always throws and directs callers to approved attach-request workflow | No active visible action. It must remain retired; do not resurrect it in the shell. |
| Remove Client | Every Supervisor in grid mode for assigned Clients | Active Supervisor and an active self-assignment; action soft-revokes the Supervisor's own assignment and their Team Manager grant | Aligned with a self-leave/remove-from-my-list action. It is not organization administration. |
| Care Team | Every Supervisor in orbit with an active Client ID | Active Supervisor, active Client assignment, and active `ClientTeamManager` grant (`activeClientTeamManagerWhere`) | Mismatch. An assigned ordinary Supervisor without the manager grant sees the link, then is denied/redirected. |

Security findings:

- Organization membership alone does **not** create Client access.
  `activeClientAssignmentWhere` requires an unrevoked `ProviderClient` plus an
  active Provider and, for organization-backed assignments, active membership
  and an active Client-organization relationship. Legacy assignments with null
  organization provenance remain an explicit compatibility case.
- A Client Team Manager grant is also insufficient on its own:
  `activeClientTeamManagerWhere` requires the manager grant and active Client
  assignment.
- Organization hierarchy is structural only. `isValidOrganizationParent`
  accepts a School-under-District relationship, but authorization predicates do
  not inherit OWNER/ADMIN authority through it.
- `searchEligibleClientProviders` first requires active Team Manager authority,
  then an active relationship between this Client and the exact organization.
  It searches only active, assignable-role Providers with active membership in
  that organization, excludes already-active assignments, limits results, and
  returns only ID/name/role. It does not disclose unrelated organizations'
  Providers.

Responsible modules include `app/dashboard/page.tsx`,
`app/dashboard/SupervisorDashboardMenu.tsx`, `src/lib/authorization.ts`,
`src/lib/clientTeamAuthorizationPolicy.ts`,
`app/actions/createClientWithProviders.ts`,
`app/actions/manageClientAttachRequests.ts`, `app/actions/manageClientTeam.ts`,
and `app/actions/manageSupervisorClients.ts`.

## 5. Provider-selection workflow

1. A Supervisor with direct administration of the selected responsible
   organization creates a Client. That organization is created as active
   `LEAD`; the creator gets the Supervisor assignment and active Team Manager
   grant. Providers selected at creation must already be active members of that
   same organization.
2. An active Client Team Manager can invite another organization as
   `PARTICIPATING`. Duplicate pending/active relationships are rejected.
3. A direct active `OWNER` or `ADMIN` of the exact invited organization approves
   (or rejects) the invitation. Parent/district authority is not substituted.
4. Only after approval makes the Client-organization relationship active do
   eligible Providers in that exact organization appear in Client-scoped
   search. Participation does not itself grant any Provider Client access.
5. An active Client Team Manager assigns an eligible Provider. The resulting
   active `ProviderClient` is what grants Client access, subject to the active
   organization and membership predicates.
6. Unrelated Providers must not appear in global search because organization
   participation is an explicit, consented boundary and names/roles are still
   sensitive disclosure. The current server search is scoped correctly.

No server-workflow mismatch was found in this sequence. The UI mismatch is
capability visibility: role-only menu links advertise workflows to Supervisors
who lack the direct organization or Team Manager capability required by the
destination.

## 6. Swipe-handler inventory

The shared owner is `components/useGuardedSwipe.ts`. It is used by
`app/dashboard/ClientCarousel.tsx`, note target/item surfaces in
`app/portal/notes/add/EntryForm.tsx` and `EntrySpecializedForms.tsx`,
`ObservationEntryForm`, and the Field Observation form.

- Gesture starts only for a primary, left-button pointer. Callers use
  `touchAction: pan-y`, preserving vertical scrolling.
- Axis locks after 8 px; horizontal requires `abs(x) > abs(y) * 1.15`. Default
  completion threshold is 56 px. Visual drag is damped to 0.34, or 0.18 at a
  blocked end.
- Buttons, links, inputs, textareas, selects, options, labels, details/summary,
  editable content, and button/menu roles are excluded unless explicitly
  allowed. `data-swipe-ignore` always excludes. A mounted `[role=menu]` disables
  all guarded swipes. Click is suppressed after a 10 px horizontal drag.
- Pointer capture owns the gesture once accepted. Horizontal movement calls
  `preventDefault`; successful completion also stops propagation.
- There is no screen-edge exclusion. iPhone/Safari may reserve or preempt the
  browser Back gesture, or the application may begin capturing at the edge;
  exact behavior requires device reproduction.

`app/portal/notes/view/NoteHistoryViewer.tsx` has a separate pointer swipe:
88 px threshold, pointer capture, `pan-y`, and basic interactive-target
exclusion. It lacks the shared hook's early axis lock and final 1.15 horizontal
dominance test. Positive X shows older and negative X newer. Case Support
workspace/request carousels and Administration carousel expose chevrons only;
no swipe handlers were found.

The Provider documentation menu marks itself/backdrop `data-swipe-ignore`, and
its `[role=menu]` also suspends the shared swipe hook while open.

## 7. Select/radius inconsistency inventory

- `components/ui/MaterialSelect.tsx` uses
  `components/ui/MaterialSelect.module.css`: 44 px minimum height, 14 px wrapper
  radius, custom chevron, controlled native appearance, focus ring, shadow, and
  explicit light/dark surfaces.
- Client creation's responsible-organization control in
  `CreateClientProvidersForm.tsx` is a plain native `select` with only inline
  padding. It does not use `MaterialSelect` or specify its radius/focus/chevron
  treatment. The same form's Create Client button hard-codes 13 px. This is the
  confirmed source of the reported mismatch.
- Attach Existing Client and Field Observation also use native selects, but
  their local modules group inputs/selects at 12 px. Their visuals therefore do
  not match the 14 px `MaterialSelect`, even though each is internally styled.
- The global token begins at `--radius: 0.9rem` and derives `--radius-sm` through
  `--radius-4xl`, but much of the existing application bypasses those tokens.
  Production styles contain hard-coded 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  18, 19, 20, 22, 24, 36, 42, circular, and pill radii across controls, cards,
  dialogs, badges, and overlays.
- Typography and padding likewise mix global classes, CSS modules, and inline
  values. Client creation is especially mixed: native fields, global material
  button classes, inline padding/radius, and locally composed provider cards.

The responsive shell should first define semantic control/card/dialog radius
roles, then migrate surfaces deliberately. A blanket radius replacement would
erase meaningful pill/circle distinctions and is not part of the navigation
slice.

## 8. Client-badge formatter inventory

Current implementations:

| Formatter/site | Behavior |
| --- | --- |
| `dashboardClientInitials` in `app/dashboard/clientGridAppearance.ts` | Raw first two UTF-16 code units of first and last name; used by Supervisor/Provider grid plus add/remove views. No trim or case normalization. |
| Inline badge in `app/dashboard/ClientOrbit.tsx` | Same raw two-plus-two slicing, rendered as two spans. |
| Local `getInitials` in `app/portal/supervisor/edit-providers/page.tsx` | Same raw two-plus-two slicing for Care Team Client list. |
| `clientDisplayCode` in `app/libs/clientIdentity.ts` | Trims each name, raw two-plus-two slicing, fallback `Client`; used by Case Support/notices and privacy-safe AI/note data projections. No case normalization. |
| Care Team detail `EditClientProvidersForm.tsx` | Splits a composed full name and slices the first and last parts. No case normalization. |
| Note history page/API | Duplicate raw `${firstName.slice(0, 2)}${lastName.slice(0, 2)}` construction. |

As implemented, `brett thomas` becomes `brth`, uppercase input remains uppercase,
and mixed case is preserved. A one-character name contributes one character, so
the badge may have fewer than four. Hyphenated and apostrophe-containing names
are not token-aware: only the first two code units count (`Jo-Anne` contributes
`Jo`; `O'Neil` contributes `O'`). Most BMP non-Latin scripts slice as expected,
but UTF-16 slicing can split astral characters, emoji, or combining grapheme
sequences.

One shared **display-only** formatter can produce the intended `BrTh` without
rewriting stored names or records: trim each part, take up to two grapheme
clusters from first and last, uppercase the first grapheme and lowercase the
second using an agreed locale, concatenate, and provide an empty-name fallback.
Before implementation, product policy is still required for particles,
hyphen/apostrophe boundaries, locale-specific casing, combining marks, and
whether a missing name should produce fewer than four characters. Privacy-safe
`clientDisplayCode` consumers should be reviewed before consolidation because
they also replace names in text, not merely paint badges.

## 9. Remaining live-reproduction questions

- On each affected browser/device, what is the interval between the closing
  pointer/click and `popstate`, and can two `history.back()` calls be observed
  before React applies `menuOpen: false`? This identifies the exact timing of
  the reported second/third tap, although the history coupling is already
  confirmed.
- Does mobile Safari reserve an edge-start gesture before
  `useGuardedSwipe` captures it, or does the carousel/note surface interfere
  with browser Back? Test left and right edges, RTL if supported, and vertical
  cancellation.
- After orbit -> Client List, confirm the source-predicted adjacent duplicate
  dashboard entries with browser Back/Forward on both Supervisor and Provider
  dashboards.
- Confirm desired explicit Back destinations for administrative routes opened
  from grid versus orbit. Today most hard-coded `/dashboard` links intentionally
  or accidentally discard selection.
- Confirm product casing/tokenization rules for apostrophes, hyphens, particles,
  locale-sensitive and non-Latin names before sharing a badge formatter.
- Confirm whether the Provider documentation menu's animated delayed dismissal
  feels like one accepted tap. It is structurally separate and should not be
  changed as part of the More fix without reproduction.

## 10. Recommended first implementation slice

Implement only a shared temporary-menu dismissal contract and correction of the
dashboard's one-layer Back transition:

1. Extract or establish one small menu-dismissal primitive used first by the
   Supervisor dashboard More menu: one native activation path, containment-aware
   outside `pointerdown`, Escape, immediate idempotent close, and action-close
   before exactly one navigation. Keep temporary menu state out of browser
   history. Add Client must use the same action-close path. Do not include the
   accepted note workflow or restyle menus.
2. Change the Supervisor and Provider orbit Client List transition so it
   consumes exactly the orbit layer (with a safe direct-entry fallback) rather
   than replacing orbit with a second grid entry. Preserve `clientId` while in
   orbit and continue replacing the active orbit URL when the carousel changes.
3. Add focused interaction/history tests for single trigger close, single
   outside close, Escape, single action navigation, no menu history mutation,
   grid -> orbit -> Client List -> browser Back/Forward, valid direct orbit URL,
   and unauthorized Client-ID fallback.

Do not combine this slice with capability-predicate changes, global Back-system
replacement, swipe redesign, radius/token migration, badge normalization, or
the responsive shell itself. Capability visibility should be a separately
reviewed authorization-alignment change because it requires explicit capability
data from the server page.
