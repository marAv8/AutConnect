AutConnect Safari environment comparison — 12 September 2026

The isolated production build is ready, but the authenticated development-versus-production symptom comparison is **not yet executed**. No evidence from this phase establishes a cause or a production fix for More, Team confirmation, or wrong Back destinations. No production application behavior changed.

**Environment and source parity**

| Item | Verified state |
| --- | --- |
| Active development source | `/Users/marinaavetisian/Desktop/ac/autconnect`; branch `agent/autconnect-ui-prototype`; HEAD `c14b069` |
| Working tree at snapshot | 124 tracked modified/deleted paths and 132 untracked paths; preserved |
| Development server | PID 38283, working directory above, port 3000; same PID remained listening after comparison preparation |
| Isolated production source/build | `/private/tmp/autconnect-env-20260912`; separate copy of source, environment files and cloned dependency files; separate `.next` and generated Prisma client |
| Production server | PID 40115, `next start --hostname 127.0.0.1 --port 3107`; verified loopback listener; ready in 65ms according to startup log |
| Build | Existing `npm run build`: `prisma generate && next build`; completed successfully, including TypeScript and static generation |
| Versions | Node 22.13.0, Next 16.2.11, React 19.2.3; macOS 26.6.2; Safari 26.6.2 (21624.5.1.11.3); tested desktop Chromium 151.0.7922.34 |
| Source comparison | 464 copied non-environment files recorded in a SHA-256 manifest; zero differences in those files against active source after build |
| Fingerprint | `1ae5ebc7f8b3cdce6a3eaa1731072a05047fb28b397d8afd97b0fe77a5c423ba` for sorted manifest |

The manifest is retained in the isolated directory as `comparison-source-manifest.json`. Secrets are excluded from the manifest/output; the isolated directory is mode 0700. The copy includes current working-tree changes, not just HEAD. No migrations, seed scripts, account creation, role changes, password resets, deployments or external AI requests ran. Google font retrieval is part of the existing Next build. An initial build attempt began before the dependency copy completed and failed with a missing Prisma module; after the copy completed, the unchanged build succeeded. This was a preparation error, not an application failure.

The active development `.next` and dependencies were not used as production output. Existing previously created test directories were not reused. The production process is intentionally loopback-only, so it is not exposed publicly or directly reachable from a phone. The authenticated comparison cannot use it as a phone endpoint yet.

**Safari inspection and actual device coverage**

The user reports already being signed into Safari. Native Safari inspection found two windows, one with no tabs and one with two tabs; one tab matches the local development host. The first attempt mistakenly targeted the front, tabless window. No cookie, credential, account identity, Client identity or page content was extracted. The existing sign-in was preserved.

Actual capabilities tested:

- Native UI tool failed at initialization: `CUA_REPL_ENABLED_SURFACES is required`.
- Native Safari WebDriver session creation was rejected: “Allow remote automation” must be enabled in Safari Developer settings. The temporary driver on port 4447 was stopped; no settings were changed.
- Apple Events can report Safari windows/tabs/version, but page JavaScript is rejected until “Allow JavaScript from Apple Events” is enabled.
- System Events UI inspection was rejected because osascript lacks assistive access.
- Playwright WebKit is not installed. Safari's native application and driver are installed; their presence is not test execution.
- `xcrun devicectl` is unavailable. A sanitized USB inventory contained no iPhone label and did contain an iPad label; this does not establish an inspectable device or exclude a wireless iPhone. No remote iPhone Web Inspector target was obtained.

Coverage is therefore **desktop Chromium public-page checks only**. There were no authenticated Safari trials, no responsive desktop Safari trials, and no remotely inspected physical iPhone trials. The already signed-in tab is not a fresh-login trial. Its account's fictional Supervisor status and approved synthetic Client have been requested but not yet confirmed.

For inspection of the existing desktop Safari page via available scripting, enable Safari Settings → Developer → **Allow JavaScript from Apple Events**. This permits read-only sanitized DOM/history inspection but does not itself attach Web Inspector or create trusted physical tap events. Native WebDriver requires the separate **Allow remote automation** setting and would use an automation session rather than assuming access to the current sign-in. Neither setting was enabled automatically.

For physical inspection: on the Mac enable Safari Settings → Advanced → **Show features for web developers**; on the iPhone enable Safari → Advanced → **Web Inspector** in Settings (Safari may be under Apps). Connect the unlocked phone to this Mac by cable, accept a trust prompt if presented, open the test page on the phone, then select its page under Safari's Develop → device submenu. Keep that page's Inspector attached for the observed trial and explicitly record attachment state. These inspection steps follow [WebKit's instructions](https://webkit.org/web-inspector/enabling-web-inspector/). Remote Automation is not required merely for a user to tap an inspected phone page.

**Session/cookie and configuration constraints**

[Session configuration](../src/lib/session.ts#L39) uses an HMAC-signed, HttpOnly, SameSite=Lax, seven-day cookie scoped to `/`, with `secure: NODE_ENV === "production"`. The signing secret is present in the copied configuration; its value was not printed. The configured auth origin is HTTP loopback port 3000. Database and environment configuration were copied unchanged. Password login uses the server action; Google OAuth constructs a callback from the request origin, so a different comparison origin would additionally need a registered callback if OAuth were used. OAuth was not invoked.

Production's Secure cookie means **plain LAN HTTP is not a valid physical-phone authenticated comparison**. A reachable HTTPS origin trusted by the phone is required, with routing/proxy settings verified without weakening cookies. Do not assume a desktop localhost exception establishes phone compatibility. The loopback production login page returning 200 does not prove authentication succeeds: actual login, cookie retention and authorized Dashboard access must be verified first. No cookies were forged, copied between browsers or manually injected.

Cookies are host-scoped rather than port-isolated. Development and production on the same host can share/overwrite the same cookie name; separate ports alone are not trial isolation. Use fresh browser contexts/profiles or appropriately isolated trusted local hostnames, with actual sign-in in each trial. Use the same scheme and comparable network path in both modes where possible so HTTP-versus-HTTPS is not an unrecorded confound. No certificate trust settings or public tunnel were introduced in this phase.

The existing development recorder is omitted by [RootLayout](../app/layout.tsx#L42) in production. The baseline verified it exists on opted-in development login and is absent in production. This difference must be recorded: identical instrumentation cannot be assumed. Keep production guards intact; use Safari Inspector event/handler/state inspection and manual counts for production. Any later use of the existing recorder as temporary test instrumentation would need its instrumented status explicitly recorded, not silently presented as ordinary production. No new recorder, blocking overlay or runtime diagnostic edits were added.

**Development-versus-production results**

Priority symptom trials:

| Measurement | Development | Local production |
| --- | --- | --- |
| Physical iPhone fresh-login trials completed / planned | 0 / 5 | 0 / 5 |
| More failed activations / attempts | N/A — 0 attempts | N/A — 0 attempts |
| Team confirmation failed activations / attempts | N/A — 0 attempts | N/A — 0 attempts |
| Wrong browser returns / attempts | N/A — 0 attempts | N/A — 0 attempts |
| Recovery repeats | Not executed | Not executed |
| Activation response times | Not measured | Not measured |
| Flashes | Not observed/tested | Not observed/tested |
| Web Inspector attached during symptom trials | No trials | No trials |

Zero attempts must not be read as zero failures or a passing rate.

Safe desktop baseline, executed in headless Chromium using a new context for every public login load, no login submitted:

| Public-page measurement | Development | Production |
| --- | --- | --- |
| Login HTTP 200 and visible Login control | 5 / 5 | 5 / 5 |
| Page-load start to visible Login control, milliseconds | 136, 125, 129, 131, 130 | 91, 57, 54, 54, 51 |
| Uncaught page exceptions in observed load window | 0 / 5 loads | 0 / 5 loads |
| Existing opted-in recorder available | 5 / 5 | 0 / 5, expected production omission |
| Unauthenticated Dashboard redirects to login | 1 / 1 | 1 / 1 |
| Web Inspector attached | No | No |

These times include automation/server/browser scheduling and reflect public login loading only, not click-to-handler latency, early Dashboard hydration, Team dialogs or restoration. The development measurements ran before production measurements; they are not a randomized performance study. No inference about the three symptoms follows from production's shorter public-page load times. [Sanitized baseline data](environment-comparison-public-baseline-2026-09-12.json) is retained.

**Confirmed findings and remaining hypotheses**

Confirmed in this phase: the same source can build and serve a local production login page in isolation; auth protection redirects unauthenticated Dashboard requests; production has different cookie transport and recorder availability; native Safari inspection is currently blocked by the settings/capabilities listed above. None is a confirmed cause of the reported failures.

The known history-listener lifecycle defect remains unchanged: both owner effects can fail to reattach after setup→cleanup→setup with the initialization ref retained. Its prior isolated reproduction is documented in [the authenticated investigation](authenticated-navigation-investigation-2026-09-11.md). No repair was made during this comparison, and no new evidence connects it to a physical-phone event. The separate search-parameter reconciliation effect can still affect return behavior.

Keep these questions separate:

1. **Unresponsive More:** did pointer/click arrive at the expected control, did its handler run, did open state change, and was the menu mounted/visible/unobstructed? Current phase has no failed activation trace.
2. **Missing Team confirmation:** did the Team handler run and reach its synchronous confirmation request? Did browser dialog handling or interception affect it? No such trial ran; success of public login rendering is irrelevant.
3. **Wrong Back destination:** was the URL/history destination grid, or did a temporary grid render precede orbit restoration? Capture the actual restoration branch and Client-equality booleans, not raw framework state.
4. **Decorative entrance or flash:** keep independent from wrong destination, and distinguish a mounted layer from possible browser preview/compositor imagery. No new causal evidence here.

When execution is unblocked, retain only the existing bounded recorder's predefined events/equality booleans and sanitized Inspector observations. The current recorder lacks all desired restoration-branch fields; if a failure reaches that point, minimally extend its allow-list in development rather than creating a second logging framework. Do not export DOM text, raw history/router trees, sensitive URLs, IDs or credentials. A paused breakpoint changes timing: record it and repeat without pausing before inferring an intermittent trigger.

**Smallest next action and decision**

First unlock read-only access to the existing desktop Safari tab by enabling JavaScript from Apple Events, and confirm that its account is the fictional Supervisor and which Client is approved synthetic data. That permits checking the existing session without requesting the password or disturbing it. Confirm whether the same iPhone is available; connect/enable Inspector as above if it is.

Before production phone trials, establish a trusted, phone-reachable local HTTPS endpoint and verify actual login succeeds with unchanged Secure-cookie settings. The current loopback HTTP server is prepared infrastructure, not a valid authenticated phone comparison. Keep source unchanged and record endpoint/transport differences.

Then run exactly five fresh-login trials in each mode on the same phone/network: one More tap, same Client, Clinical Note, Team confirmation **Cancel** with form unchanged, browser Back, and the failed action repeated after recovery. Record failures/attempts, response times where measurable, wrong-return counts, flashes separately, and Inspector attachment. Compare matched attached-inspector trials first; if they all pass, an uninspected repeat may be necessary because inspection can perturb timing. Do not submit notes or invoke AI.

Current evidence supports **further authenticated mobile testing**, not a focused UI repair and not an assertion that production deployment solves anything. It also does not establish desktop-only demo readiness: this phase verified public login rendering, not authenticated desktop workflows. No production navigation, permissions, animation, notification positioning, layout or deletion changes were made.

The development server remains running. The isolated production server remains available at `http://127.0.0.1:3107/login` for local preparation; it has not been publicly deployed. Temporary Safari WebDriver was stopped. No user session was signed out or altered.
