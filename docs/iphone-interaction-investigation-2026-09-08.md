# iPhone interaction investigation — September 8, 2026

The recorded product failures remain **unresolved on physical Safari**. Current-source synthetic browser tests did not reproduce them. This change repairs a reproduced obstruction in the opt-in diagnostic panel and improves the existing trace and regression coverage; it does not claim a navigation or input fix for the recordings.

## Environment and existing work

Before editing, port 3000 was identified as PID 67846, `next-server (v16.2.11)`, with working directory `/Users/marinaavetisian/Desktop/ac/autconnect`. The worktree is `agent/autconnect-ui-prototype` at `c14b069`. The separate `autconnect-prod-test` and `autconnect-webpack-test` directories were not used. HTTP checks returned 200 from the existing server; no server was restarted or build output deleted. The LAN address was verified as `192.168.1.170`.

The worktree already had extensive tracked modifications and untracked files: Dashboard owners/shell/carousel/menu code, note forms, navigation/restoration helpers, the opt-in interaction trace, a continuity harness, tests, and unrelated actions, authorization, AI, schema and migrations. Those existing changes were preserved. No dependencies, schema edits, commits, pushes or deployment were added.

Already implemented before this investigation:

- More uses `useDismissibleMenu`, with synchronous local state and no temporary-menu history entry.
- Documentation launch uses the existing exit animation, then `flushSync(dismissOwnNotesPrompt)` before invoking the route/overlay callback. Reduced motion closes synchronously. Closing panels are inert.
- Dashboard history/provenance and Client-specific orbit restoration helpers exist; Client keys remain in place.
- Guarded carousel gestures exclude browser edges and interactive controls.
- Private/Team uses controlled buttons with handler/state trace calls and an explicit sharing confirmation.
- The early development-only trace and local Clear / Disable & delete controls exist.

The older interaction audit is not a reliable description of all current behavior. The current visibility buttons are deliberately styled as radios by `.visibility-selection-control::before`; their appearance in the recordings does not establish a source-version mismatch. There is no recorded bundle fingerprint tying the phone sessions to this exact worktree state. The current local test URLs were served from this verified worktree; the historic phone bundle cannot be confirmed retroactively.

Both supplied videos are 828 × 1792 with audio, lasting 129.392 s and 109.260 s. Exact phone model and iOS/Safari version are unavailable. The address bar shows the LAN host. Observations below come from extracted video frames, correlated with the narration supplied in the request; finger positions and exact tap times are not available.

## Recording observations

Times are approximate elapsed recording time, not the status-bar clock.

| Recording | Time | Visible evidence |
| --- | --- | --- |
| Supervisor | 0:00–0:05 | Password-save prompt, then Dashboard grid. |
| Supervisor | 0:05–0:30 | Grid moves vertically; utilities remain visually closed. Narration reports failed More/Notifications/Theme attempts. Frames cannot identify individual taps. |
| Supervisor | ~0:30–0:55 | Selected Client orbit; a note-view empty state appears around 0:45, followed by return to the same orbit. |
| Supervisor | ~1:05–1:20 | Documentation menu → Field Observation → orbit. Sampled return does not show a menu flash. |
| Supervisor | ~1:25–1:36 | Clinical Reflection remains Private while the view shifts vertically during the reported Team attempts. No confirmation is visible in sampled frames. |
| Supervisor | ~1:36.5–1:36.8 | During edge-back transition, the documentation menu is visible, followed by the orbit with menu absent. |
| Supervisor | ~1:50–2:00 | Grid and an open More menu are visible, supporting later successful interaction. |
| Provider | ~0:05–0:15 | Information panel opens and closes. The request reports successful theme switching; sampled frames alone do not establish its exact timing. |
| Provider | ~0:20–0:30 | Selected orbit and Update Note submenu are visible. |
| Provider | ~0:40–0:55 | Case Support → same selected orbit; sampled return is clean. |
| Provider | ~1:00–1:18 | Other Client positions appear, then return to the prior selection. No gesture direction is inferred. |
| Provider | ~1:20–1:27 | ABC workflow visible. |
| Provider | ~1:26.9–1:27.2 | Edge-back reveals the Update Note submenu briefly, then the menu disappears and the selected orbit remains. |

A menu image during a browser transition does **not** establish whether it is live React state, Safari's saved preview, or an exit layer. Neither video includes DOM/event/history evidence to resolve that distinction.

## Four-path comparison in current source

| Journey | Ownership / history | Launch closure / return |
| --- | --- | --- |
| Supervisor Field Observation | `ClientOrbit` launches a route with `router.push`; Field Observation origin/return marker records the selected orbit. | Shared documentation exit completes before navigation. Dashboard can unmount on departure. Native Back restores the prior entry; the real form's visible Back uses its validated origin/fallback helper. |
| Supervisor Clinical Reflection | `ClientCarousel` opens a same-page note overlay and pushes `autConnectDashboardOverlay` at the same URL. The Client-keyed orbit remains mounted underneath. | Same menu-exit helper completes before history push. Visible Back clears overlay state then consumes its entry; native Back clears the active overlay through popstate. |
| Provider Case Support | `ClientOrbit` uses `router.push` to the Case Support route. | Same menu-exit helper; route departure can unmount Dashboard. The real route has a Client-specific return destination. |
| Provider Update Note → ABC | Completed/read synthetic note opens primary menu, then local `ownMenuMode="update"`; ABC is a same-page carousel overlay. | Same shared closure and same-URL overlay history as Clinical Reflection. Submenu state resets during dismissal. |

The important structural difference is route departure versus a persistent underlying orbit, not role alone. The current menu is a body portal; its backdrop owns outside activation and its closing panel is inert. `provider-action-menu-open` follows its mounted lifetime. Overlay mounting saves/restores body overflow; Escape invokes overlay close. The overlay uses Motion exit layers. No new focus, scroll, restoration or animation behavior was introduced here.

Current local tests see **zero mounted documentation menus** during observed overlay returns. This rules out a live menu in those runs only; it does not rule out a physical Safari preview or a different historic bundle. Route tests exercise the real Dashboard owners and launches but substitute a synthetic destination, so they do not constitute acceptance of the real route forms' Back controls.

## Confirmed findings and targeted changes

1. **Diagnostic panel obstructed ABC visible Back at small-phone size.** The executed Provider test failed because `#autconnect-dashboard-trace-panel` intercepted pointer events on the Client button. The panel was fixed at top-left. Moving it to top-right makes that same test pass. The recordings do not show this panel, so this is a diagnostic defect, not an explanation for their failures.
2. **Trace lacked distinct resulting utility/menu states.** An executed full-owner regression failed for missing `inbox-open` and `documentation-closed` events after successful interaction. Added Inbox, Theme and documentation primary/update/closing/closed state events to the existing trace. No replacement tracing system was created.
3. **Added diagnostic context without clinical content.** Events now include document ready state, fixed boolean mounted-layer/theme observations, passive touch start/end/cancel, and cancellation flags. Hit tests remain allow-listed; the diagnostic panel has its own classification. Existing pointer, click, lifecycle and handler events remain. A mounted layer is not proof of painted visibility, and `readyState`/the shell's hydration effect are not proof that every control has hydrated.
4. **Expanded the existing development fixture.** It can mount actual Supervisor/Provider owners beneath the shared shell. The Provider fixture contains a completed, read synthetic note so Update Note is exercised. Initial fixture options are server props, preserving the fixture across route remounts. This corrects a test-fixture issue, not product restoration.

Trace retention remains local and bounded at 160 events, with Clear and Disable & delete. No text, input values, Client IDs, raw DOM, credentials or full URLs are added to diagnostics. Existing production guards remain; no production build/deployment comparison was performed.

## Results and limits

- Baseline existing focused browser suite: **12 passed, 0 failed**.
- New before-fix diagnostic assertion: failed for absent state labels; the corresponding interaction journey itself completed.
- New Provider small-phone visible-Back check: failed with explicit trace-panel interception; passed after placement correction.
- Final combined focused suite: **20 passed, 0 failed** across desktop Chromium and the configured iPhone 8-sized Chromium project. Additional final trace assertions: **2 passed, 0 failed**.
- Complete native suite: **577 passed, 0 failed, 0 skipped**, across 76 test files.
- TypeScript: `tsc --noEmit --incremental false`, exit 0.
- Lint: `npm run lint`, exit 0. Diff whitespace check: clean.
- Node 22.13.0; Playwright 1.62.1; bundled Chromium 151.0.7922.34; Next development server 16.2.11 on macOS. No physical Safari test was run.

New browser tests capture all console errors and uncaught page errors and assert none. They intercept non-GET operations and API services; route destinations are synthetic. No real note was submitted or acknowledged, no invitation/request was sent, and no external AI call was authorized by these tests.

Verified locally: first/repeat utility activation, repeated native/visible overlay Back, Private→Team confirm/cancel and reversal in create mode, no menu during observed return mutations, focused-workflow dock absence and return, correct Client URL, route Back/Forward, grid/orbit Forward, chevrons and cross-Client menu isolation. Existing native gesture tests pass.

**Still unverified:** physical Safari edge gesture/preview behavior; early-login hydration/input failure; exact event-pipeline stopping point on the affected phone; physical Team activation; browser-level unsaved-work acceptance and real route-form visible Back; overlay Forward workflow restoration. Existing overlay history stores a boolean rather than a restorable workflow descriptor, so passing route Forward is not evidence of overlay Forward restoration. No unsaved-work or persistence behavior was changed. These limitations are not masked by the passing totals.

## Phone capture and acceptance

Verified existing development trace URL:

`http://192.168.1.170:3000/login?debugInteractions=1`

For an already signed-in session:

`http://192.168.1.170:3000/dashboard?debugInteractions=1`

1. On the same LAN, open the login trace URL **before** signing in to capture initialization and first Dashboard use. Record phone model, iOS version, browser and whether it is a fresh tab. The small trace panel should appear at top-right. Its presence is diagnostic initialization, not proof that Dashboard handlers are attached.
2. Keep the panel collapsed while interacting. Try More, Notifications and Theme once each, then select a Client and try again. Record visible outcomes and narration; do not infer hidden tap contacts. Retrieve this short trace promptly before its 160-event bound rotates the beginning away.
3. Open the panel and tap **Show**; select/copy the JSON text. **Copy** may be unavailable on plain LAN HTTP, so Show is the fallback. Save/send only the sanitized output with approximate recording times. Then Clear for the next short journey. To investigate first initialization again, reload after Clear and repeat from login as appropriate.
4. Separately capture each of the four journeys above, testing both visible Back and native edge Back, then repeating entry/return. Keep the same Client and note whether the menu appears during the gesture, after completion, or both. Test grid/orbit and route Forward separately. Do not use View Notes merely as a test control because reading can acknowledge notes.
5. For Private/Team, use an **empty new** Clinical Reflection. Do not change visibility of an existing saved note. Test cancelling and accepting the confirmation, observe selection, and return without typing or submitting. Do not enter clinical text, submit ABC/Field Observation, send Case Support requests, or invoke AI while capturing diagnostics.
6. Compare the newer phone using the same short journeys; do not treat the older device or network as the cause without evidence. If a trace has pointer/click but no handler, inspect cancellation, hit classification and initialization; do not label it a frozen browser automatically. A handler followed by state followed by a mounted layer narrows the next investigation but does not prove the compositor painted it.
7. Finish with **Disable & delete** and remove `debugInteractions=1` from the address before reloading, otherwise that parameter enables the trace again.

Stop point: diagnostic obstruction repaired and coverage expanded. No speculative product interaction change was made. Physical traces are required to establish a further repair.


## Rerun requested by the user

The rerun rechecked both return-frame sequences and the existing implementation, confirmed the same active server/worktree, and exercised native desktop Safari in addition to Chromium. No additional production behavior change was made.

**Correction to the first pass:** the apparent radio controls in the videos are compatible with the current button implementation. The current CSS renders the radio circles. The earlier visual argument for an older implementation was incorrect and has been removed above.

Native Safari 26.6.2 (21624.5.1.11.3) was controlled through its accessible UI. The Provider fixture ran directly on port 3000. A temporary localhost-only test proxy on port 3106 supplied synthetic Clinical Reflection form data and blocked all non-GET/HEAD operations; it did not replace or restart the app server. The proxy was removed from service after testing.

| Native Safari check | Rerun result |
| --- | --- |
| Provider first-use Inbox and Theme | Inbox visibly expanded/collapsed; Theme changed its pressed state and label. |
| Provider Update Note → ABC → browser Back | Actual submenu and ABC mounted. Back returned to the selected orbit with menu absent in the subsequent accessibility state. This is not a frame-by-frame physical edge-gesture acceptance. |
| Supervisor first-use More, Notifications and Theme | Both menus visibly expanded/collapsed; Theme changed state before entering a workflow. |
| Supervisor Clinical Reflection launch | A blank inert documentation panel persisted across observations. Opening Web Inspector was followed by workflow appearance. The cause of the delay remains unresolved; inspector opening also changes browser/window conditions. |
| Supervisor Private → Team → Private | The sharing confirmation appeared. Accepting it selected Team; Private selected successfully afterward. The form remained empty and no note was submitted. |
| Supervisor browser Back | Dock controls returned, but the outgoing Clinical Reflection was still present in subsequent native UI snapshots. This is an unresolved Safari transition observation; it is not a clean return acceptance and is not proof of the recorded menu-preview mechanism. |

Native console inspection found a favicon 404 and a 409 generated by the deliberate test proxy mutation block. These errors were not suppressed or counted as a clean native console. No native JavaScript exception was shown in the inspected console. The native-control session also reported screen-capture/clipboard/no-window errors. Those tool errors and the observed transition delays are recorded separately; neither establishes the phone defect's cause.

Safari WebDriver was attempted without changing browser settings. It rejected session creation because **Allow remote automation** is disabled. That setting was not enabled. The temporary driver was stopped. No reliable automated Safari acceptance or physical iPhone acceptance is claimed.

The new regression coverage uses actual touch activation for Team in the phone project, and Chromium touch sequences for interior carousel movement and edge-start exclusion, for both Dashboard owners. The edge test checks that the app does not change Client from an edge-start drag; it does not simulate Safari's native navigation gesture.

Rerun validation: **24 focused browser tests passed, 0 failed**, in the two existing Chromium projects; **577 native tests passed, 0 failed, 0 skipped** (76 files); TypeScript and lint exit 0; diff whitespace check clean. The existing 20 browser checks are included in the 24, not additional to them. The expanded owner suite also passed separately, 12/12, during development.

The phone capture URLs and procedure above remain applicable. The unresolved native Supervisor animation observations should be captured with lifecycle trace evidence before choosing a further repair. This rerun adds browser evidence and fixes the earlier report, but does not establish the three recorded product failures as repaired.
