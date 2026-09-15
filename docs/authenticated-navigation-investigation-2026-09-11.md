AutConnect authenticated-navigation investigation — prerequisite blocked; lifecycle defect reproduced

**Real authenticated journeys executed: none.** This phase has not satisfied authenticated end-to-end verification. No fixture, mock route, generic Back button, cookie injection or prior browser result is counted as a real journey.

The prerequisite is access to an existing, authorized synthetic Supervisor login and Provider login, plus identification of two authorized synthetic Clients (A and B). Records must allow the requested Clinical Note, ABC update, Field Observation, Case Support and note-history paths under existing permissions. Account scope must also identify a grid-launched administrative destination available to that role. If the accounts cannot access a path, report that restriction rather than change roles or seed records.

Repository/environment inspection found no configured test-login credentials. The local Phase 2 fixture script defines fictional Supervisor/Provider identities, but generates random passwords and hands them off only in an OS dialog at creation; existing credentials are not redisplayed. Its definitions do not establish that suitable accounts currently exist or have the requested two-Client workflow data. The authenticated-onboarding test creates accounts and database records; it was **not run**. No database was seeded, account created, password reset, role changed, or real record read/acknowledged. The user has been asked where the existing credentials and approved records can be accessed.

No applicable AGENTS.md was found in the repository (including hidden paths, excluding generated/dependency trees) or checked ancestor directories. The latest comparative diagnosis was read; its synthetic results remain explicitly synthetic. Existing working-tree changes were preserved.

**Intended hierarchy and implemented map**

L1 = Dashboard grid. L2 = selected Client orbit. L3 = focused workflow or administrative destination. More, Notifications and Provider-plus are launch surfaces, not destinations. The table is a **source map**, not an authenticated observation. Every row's real first/repeat and visible/browser return result is pending credentials.

| Origin → destination | Launch surface; form; owner | Current history / visible Back | Browser restoration and identity | Intended versus observed |
| --- | --- | --- | --- | --- |
| Login → L1 → L2 A/B | Actual login server action; grid Client control; SupervisorDashboard or ProviderDashboard, then carousel index | Login redirects Dashboard; owner replaces initial metadata; Client selection pushes orbit; carousel change replaces Client URL | Back grid / Forward orbit when metadata and URL agree; validated direct orbit has no invented grid predecessor | Intended selected Client, later grid. Authenticated observation pending |
| L2 → Field Observation | Provider-plus; full route; ClientOrbit launch and FieldObservationForm return | Replace origin entry with exact presentation marker, push route, bind trusted origin marker to destination; visible Back consumes trusted route or replaces with validated Client-orbit fallback | Native Back restores actual predecessor; Dashboard owner validates orbit URL/Client metadata | Intended same Client, closed menu; authenticated observation pending |
| L2 → Clinical Note/Reflection | Provider-plus; focused overlay; ClientCarousel and DashboardNoteOverlay/EntryForm | Push same-URL overlay boolean; visible Back clears local overlay then history Back | Popstate clears overlay; original orbit metadata remains. Forward cannot reconstruct workflow from boolean alone | Intended same Client, later grid; authenticated observation pending; Forward gap previously reproduced only synthetically |
| L2 → Update Note → ABC | Provider-plus primary/update submenu; focused overlay; local menu then ClientCarousel | Submenu adds no history; ABC pushes overlay entry; actual ABC Client control closes/consumes it | Same overlay restoration limitations; Client-keyed orbit remains below workflow | Intended same Client with submenu closed; authenticated observation pending |
| L2 → Case Support active/request | Provider-plus; full route; ClientOrbit then route page | Router push; real visible Back is a Link pushing the Client-orbit URL, not history Back | Native Back from route goes to actual O predecessor; visible-Link return followed by browser Back can revisit Case Support | Intended origin return; source shows visible/native history difference; authenticated observation pending |
| L2 → View Note(s) | Provider-plus or provider badge; focused reading overlay; ClientCarousel / DashboardNoteOverlay | Same-URL overlay push; actual Back invokes overlay close; real history GET may acknowledge synthetic notes | Same local-overlay / history-boolean Forward gap; Client held underneath | Intended same Client with launch surface closed; authenticated observation pending, including nonempty notes |
| L1 → Attach Existing Client | More (Supervisor may use Client Administration disclosure); full route; menu local state, Next routing, page authorization | Launch Link closes menu and pushes route; actual Back to Dashboard is Link to `/dashboard`, pushing a new grid destination | Native Back returns original grid entry; visible Back followed by browser Back can revisit administration. No Client-specific origin is carried | Representative administrative L3 for roles with capability; authenticated observation pending |
| L1 → How AutConnect Works | More; informational dialog, not launch menu; owner `guideOpen` state | Menu closes, local dialog opens; Close clears local state. No history entry | Browser Back is not owned by the dialog and can leave the origin; it is not equivalent to Close | Source-only additional distinction; not substituted for requested administrative L3 |

Source references: [Supervisor owner](../app/dashboard/SupervisorDashboard.tsx#L138), [Provider owner](../app/dashboard/ProviderDashboard.tsx#L121), [overlay owner](../app/dashboard/ClientCarousel.tsx#L95), [Field Observation navigation](../app/dashboard/fieldObservationNavigation.ts#L191), [Case Support Back](../app/portal/case-support/[clientId]/page.tsx#L649), [request Back](../app/portal/case-support/request/[clientId]/page.tsx#L132), [Supervisor grid menu](../app/dashboard/SupervisorDashboardMenu.tsx#L121), [Provider grid menu](../app/dashboard/ProviderDashboardMoreMenu.tsx#L43), [administrative Back](../app/portal/organization/attach-client/page.tsx#L49), [guide](../app/dashboard/DashboardProductGuide.tsx#L7).

A Link returning to the right visual screen can still contradict the desired subsequent history sequence. A focused overlay can be L3 despite sharing the URL. Conversely the informational guide is a dialog with local Close behavior and no history contract; it should not be mistaken for a temporary launch menu or used to claim administrative end-to-end coverage.

**Direct lifecycle experiment: confirmed defect**

The retained [reproduction script](diagnostics/dashboard-history-listener-lifecycle.cjs) parses the actual current SupervisorDashboard and ProviderDashboard TypeScript ASTs, extracts each initialization/listener effect callback, transpiles and executes that callback with synthetic Client metadata and a controlled event-listener registry. It uses the actual navigation validation helpers. It does not render a Dashboard or simulate an authenticated journey. React's scheduler and Next's search-parameter effect are outside this deliberately isolated experiment.

Run from the project root:

```sh
node --test docs/diagnostics/dashboard-history-listener-lifecycle.cjs
```

Both tests deliberately assert the required behavior and **fail on the current source**:

| Step | Supervisor | Provider |
| --- | --- | --- |
| First setup with valid existing orbit metadata | Restores orbit; attaches 1 listener | Restores orbit; attaches 1 listener |
| Dispatch grid popstate | Handler invokes owner state setters | Handler invokes owner state setters |
| Cleanup | Removes listener; initialized ref stays true | Same |
| Setup again, retaining the ref | Early return; 0 listeners | Same |
| Dispatch next popstate | No owner handler invocation | No owner handler invocation |

Final result: **0 passed, 2 failed**, both at “second setup must reattach after cleanup”, expected 1, actual 0. Test lint passes. An initial harness run omitted the URL global required by the real validation helper; that harness error was corrected before the result above. No product code was changed to obtain this failure.

Causal chain in the actual callbacks: `if (historyInitializedRef.current) return` precedes listener setup; first setup sets the ref; returned cleanup removes the listener; re-setup returns before `addEventListener`. Source anchors: [Supervisor guard](../app/dashboard/SupervisorDashboard.tsx#L138), [Supervisor subscription](../app/dashboard/SupervisorDashboard.tsx#L228), [Provider guard](../app/dashboard/ProviderDashboard.tsx#L121), [Provider subscription](../app/dashboard/ProviderDashboard.tsx#L196).

This establishes failure for the requested setup → cleanup → setup sequence. It does **not** establish that this sequence occurred in the phone recording, that browser Back selected grid, or that authentication/development mode caused anything. The separate owner effects keyed by search parameters can recover valid history state. We must observe their ordering in a real authenticated journey before claiming symptom causality.

**Competing state responsibilities**

The owners initialize mode/Client from server props, then reconcile history against live location and allowed Client membership. They also restore through popstate and a search-parameter-dependent effect. Next maintains URL/router state. ClientCarousel independently initializes local index from `initialClientId`, reports its selected Client to the parent, and manages local workflow/provider/kind state plus overlay history refs. Changing a parent `initialClientId` is not itself a local-index reset. Thus owner mode, owner Client, browser metadata, Next search parameters, carousel index and local overlay state have overlapping responsibilities; current code demonstrates the overlap, but no authenticated ordering conflict has yet been captured.

Menu closure is separately owned and should stay local: shared documentation exit completes before launch callback; Supervisor/Provider More uses dismissible local state. A coherent navigation correction must not make those menus history destinations. Keep genuine Client changes isolated by their current keys and keep authorization independent of navigation metadata.

**First-use/repeat and symptom status**

| Question | This investigation's result |
| --- | --- |
| First authenticated return versus repeat, Client A versus B | Not executed; credentials/approved synthetic records required |
| Wrong destination | Unresolved; no new authenticated reproduction |
| Temporary grid render before correct orbit restoration | Unresolved; requires initialization branch and pre-paint evidence |
| Decorative entrance replay | Prior synthetic observation only; animation work is out of this task |
| Live menu flash versus browser preview/compositor | Unresolved; no new browser/physical capture |
| Unresponsive controls | Unresolved; no authenticated activation timeline |
| Listener reattachment | Confirmed isolated failure for both actual owner effect bodies |

Browser availability check only: local Playwright Chromium binary exists, Playwright WebKit binary is absent, native Safari application exists. **No desktop, WebKit or Safari workflow was executed in this phase.** Safari automation capability was not newly verified. No installation/settings changes were made. A binary-availability check is not browser acceptance, and programmatic Back would not establish physical iPhone edge-gesture behavior.

**Minimal correction proposal and regression scope — not implemented**

Separate the existing Dashboard owners' one-time history initialization from their event-subscription lifecycle. Guard only initialization; every effect setup must attach its popstate handler, and every cleanup must remove that same handler. This can be two effects, or one effect whose guarded initialization block is followed by unconditional subscription. Preserve the current validated initial-restoration policy, state setters, URL/provenance data and search-parameter reconciliation. Do not reset the initialization ref merely to force subscription: that would also rerun initialization/history replacement.

That correction directly addresses the isolated defect without adding history entries, a restoration cache, delays, swipe ownership, or visual changes. Its risk is duplicate listeners or altered restoration order if implemented carelessly. The retained failing tests must pass, with extended assertions for repeated replay, one callback per event, final cleanup and no extra history mutation. Then test actual login/grid/orbit, A→B, visible/browser Back, subsequent Back/Forward, direct/reload and invalid-Client fallbacks for both roles. Preserve draft handling and all server permissions.

Do not yet change carousel index restoration, overlay history descriptors or Case Support Back. Their current source differences warrant the real journey comparison, but the responsible owner for the reported phone return is still unknown. The prior Case Support presentation-marker proposal is not the priority or authorization for this task; visual resizing and animation redesign are excluded.

**Smallest remaining evidence**

First prerequisite: existing authorized synthetic account access and two approved Clients. Once available, execute the real login UI and real destinations without substituting pages or controls. Use new contexts for first-use cases and repeat each journey within its context; test visible Back and browser Back separately, then subsequent Back/Forward. Exercise nonempty synthetic history only within that approved scope; do not invoke external AI or write real records.

For those runs, extend the existing bounded development recorder only as needed with allow-listed restoration-branch and lifecycle categories: owner initialized/reattached/cleaned/invoked; history push/replace/pop and grid/orbit/workflow category; URL/owner/carousel Client equality booleans; menu/workflow mounted/closing; carousel mount, visibility, dimensions and entrance-start. Use its existing retention, frozen export and disable/delete controls. No parallel recorder or application runtime instrumentation was added while execution is blocked.

The smallest causal test after access is one fresh-login Client B workflow return that demonstrates the listener failure or restoration mismatch, immediately followed by the same return repeated in the same session, with branch/lifecycle evidence. If the wrong return still cannot be reproduced on desktop/Safari, only then request one specific phone journey selected by the authenticated result. A broad new phone recording is not requested at this stage.

Only this report and the isolated diagnostic reproduction were added in this phase. Production navigation, deletion, data, notifications, layout and animation remain unchanged. The real authenticated portion is paused pending the stated prerequisite.
