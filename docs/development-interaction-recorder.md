# Development interaction recorder

This is an opt-in diagnostic recorder, not a fix for authentication, intermittent first-use controls, or the return-menu flash. Route labels and pointer cancellations are clues, not diagnoses. It is unavailable in production.

## Phone capture

Use the same Safari tab on the same LAN:

**http://192.168.1.170:3000/login?debugInteractions=1**

1. Open **Interaction trace** and choose **Fresh capture**. Collapse the panel. If startup timing is needed, reload this login URL now; capture survives that reload.
2. Sign in normally. On Dashboard, tap **More once**, whether or not it responds.
3. Open the recorder and choose **Show** promptly. It freezes the currently retained evidence. Live capture continues separately.
4. Choose **Copy**. Trust the success message only if it says **Copied the displayed snapshot**. Plain LAN HTTP may not offer clipboard access: use **Select text**, then the phone's native Copy menu (long-press the read-only field if needed), or **Download JSON** and check browser Downloads/Files.
5. Retrieve this snapshot before retrying the application interaction. A failed attempt is useful even without a handler or resulting state. Repeated panel interactions cannot evict product evidence, and selecting/scrolling/copying cannot change the frozen text. **Refresh snapshot** is the only action that replaces an existing snapshot with newer live evidence. Copy and Download export the snapshot shown at the time of the action, not a later buffer read.
6. For a separate attempt, first save/export the previous snapshot, then choose Fresh capture and repeat. To capture another first-login sequence, begin again from the login URL using the app's normal session flow.

No recording procedure requires submitting a note, acknowledging notes, entering clinical data, sending a request/invitation, or invoking AI.

## Retention policy

Retained events are sorted and deduplicated by sequence. There are at most **160 distinct events**, selected from three bounded groups:

- Up to **32 earliest unique lifecycle markers** by route category, kind and state. These include recorder bootstrap/capture start, page show/hide, visibility, popstate, hydration, grid/orbit and focused-workflow markers. Repeated identical marker categories do not consume these slots.
- The first **30 events from the first identifiable utility attempt**, plus the **first matching handler** and **first matching state after that handler**, stored independently so delayed evidence can survive even after the context window fills. Utilities are More, Inbox, Theme and Team Focus. A pointer-down, touch-start, captured click or handler with an allow-listed utility target can start this group. Matching labels and order do not prove causation. If the browser supplies no identifiable event, the recorder cannot manufacture an attempt marker.
- The **96 most recent product/lifecycle events** for later context.

All event arrays and metadata remain bounded in this tab's sessionStorage. Events from inside the diagnostic panel, including its field and controls, are ignored before recording. No DOM events are stopped, cancelled or modified by this filter. Lifecycle events continue to be recorded.

Exports are JSON objects with a retention description, `totalRecorded`, `droppedEvents`, `firstUtility` and `events`. `droppedEvents` is the number of recorded product/lifecycle events no longer retained; excluded panel traffic is not counted as product evidence. A missing event is therefore distinguishable from a known truncated history, but not automatically attributable to a browser/application failure.

Sequence numbers order a capture across same-document and full-document navigation. The `document` counter distinguishes document/restore segments because `elapsedMs` is document-local performance time. Restored documents reconcile newer session evidence before recording. Disabled recorders do not reactivate on a cached-page restoration.

Old recorder arrays are imported only as sanitized recent context, with panel records removed. `legacyHistoryUnavailable: true` explicitly marks unknown earlier loss; old sequence numbers are not miscounted as product-event totals. Initialization already overwritten by the old recorder cannot be recovered. Start a fresh capture for the new retention policy.

## Controls and privacy

- **Show:** freeze and display a snapshot if none exists; never silently refresh an existing one.
- **Refresh snapshot:** explicitly replace the displayed snapshot with current retained events.
- **Copy:** await Clipboard API success; otherwise display manual-copy/download guidance. Selecting text alone never produces a “copied” message.
- **Select text:** focus/select the read-only snapshot for the device's native copying controls. It does not claim to copy.
- **Download JSON:** request a local file containing the exact displayed snapshot. The message asks the user to check downloads; it does not claim the OS saved the file.
- **Clear:** erase retained evidence and the displayed snapshot, preserving sequence numbering. Capture remains enabled and continues with later events.
- **Fresh capture:** erase evidence/snapshot, restart sequence numbering and add a capture-start marker. It does not navigate, reload, or sign in. Reload afterward if new document initialization is required.
- **Disable & delete:** stop/remove recorder listeners, delete recorder session storage, clear the snapshot, revoke its file URL, remove the panel and delete its API. Also remove `debugInteractions=1` from the address before reloading; that explicit parameter otherwise opts in again. Downloaded files or text already copied remain under the user's control.

The panel is collapsed by default, constrained to its visible bounds, and has no invisible backdrop. It records only predefined labels, sanitized numeric metadata and booleans. Credentials, identities, Client IDs, full URLs, form values, raw DOM and clinical text are neither recorded nor exported. Previously stored event objects are sanitized again before use. No uploads or telemetry are added.

## Verification

Executed browser coverage includes panel-traffic exclusion and unchanged propagation, bounded first-use retention with delayed handler/state, login-page-to-synthetic-Dashboard continuity without authentication submission, immutable Show, exact Copy/download payloads, clipboard absence/rejection and asynchronous success, manual fallback, Clear/Fresh/Refresh/Disable, restored-page reconciliation, and representative phone Back controls plus hit-testing outside the panel.

The login continuity test navigates from the real login page to the synthetic Dashboard owner; it does not submit real credentials or test the authentication implementation. Cached-page restoration is tested with a synthetic persisted pageshow event, not physical Safari's cache implementation.

Production tests execute the recorder with a production environment and render the actual production RootLayout, verifying that diagnostics are omitted while the existing theme script remains. A production deployment/build was not performed.

Browser tests use desktop Chromium and the configured iPhone 8-sized Chromium environment. Clipboard absence and rejection are simulated. Physical Safari clipboard/share/download acceptance remains a phone check; passing emulation is not physical Safari acceptance.

Final results: **44 browser checks passed** (42 combined recorder/Dashboard checks plus 2 legacy-migration checks), **147 relevant native tests passed**, including 2 production-exclusion tests. The production checks were rerun after the final metadata change. TypeScript (`tsc --noEmit --incremental false`), lint and diff whitespace checks passed. Before the repair, the two executed regression cases for panel eviction and frozen output failed as expected. No product behavior, dependencies, commits, pushes or deployment were changed by this recorder repair.
