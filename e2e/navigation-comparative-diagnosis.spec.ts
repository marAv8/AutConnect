import { expect, test, type Page } from "@playwright/test";

async function syntheticServices(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    // No server action, database write, acknowledgement or AI request reaches a service.
    if (request.method() !== "GET" || /\/api\/(?!notes\/form-data)/.test(url.pathname)) {
      return route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    }
    if (url.pathname === "/api/notes/form-data") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        clientId: "continuity-client-a", role: "Supervisor", providerId: "continuity-supervisor",
        clientName: "Alpha Client", providerName: "Sam Lead", providerRole: "Supervisor",
        targetOptions: [], noteKind: "ClinicalNote", mode: "create", draft: null,
        draftWorkflowKey: "ClinicalNote",
      }) });
    }
    // Route controls use a synthetic destination, preserving the real launch and browser history.
    if (url.pathname.startsWith("/portal/")) {
      const response = await route.fetch({ url: `${url.origin}/dev/dashboard-continuity/workflow${url.search}` });
      return route.fulfill({ response });
    }
    return route.continue();
  });
  return errors;
}


// Diagnosis only: all services and route destinations remain synthetic.
// Visiting login establishes fresh history; it does not authenticate a user.
for (const role of ["supervisor", "provider"]) {
  for (const journey of ["note", "route", "view"]) {
    for (const back of ["browser", "visible"]) {
      test(`${role} ${journey} ${back}: fresh history and repeat`, async ({ page }, testInfo) => {
        const errors = await syntheticServices(page);
        await page.addInitScript(() => {
          const records: unknown[] = [];
          Object.assign(window, { __comparison: records });
          const snapshot = (operation: string) => {
            const s = history.state;
            const layer = s?.autConnectDashboardLayer ?? s?.autConnectProviderDashboardLayer;
            const u = new URL(location.href);
            records.push({ operation, path: u.pathname.startsWith('/portal/') ? 'workflow-route' : u.pathname === '/dashboard' ? 'dashboard' : 'fixture-or-login',
              urlOrbit: u.searchParams.get('view') === 'orbit',
              mode: layer?.mode ?? null, owner: layer?.navigation?.owner ?? null,
              clientMatchesUrl: !!layer?.activeClientId && layer.activeClientId === u.searchParams.get('clientId'),
              gridPredecessor: layer?.navigation?.hasGridPredecessor === true,
              overlay: s?.autConnectDashboardOverlay === true,
              presentation: !!s?.autConnectDashboardOrbitPresentation,
              menu: !!document.querySelector('[role="menu"][aria-label="Documentation"]'),
              workflow: !!document.querySelector('[data-dashboard-trace-layer="workflow-overlay"]') });
            if (records.length > 120) records.shift();
          };
          for (const name of ['pushState', 'replaceState'] as const) {
            const original = history[name].bind(history);
            history[name] = function (...args: Parameters<History[typeof name]>) {
              original(args[0], args[1], args[2]); snapshot(name);
            };
          }
          addEventListener('popstate', () => snapshot('popstate'));
          Object.assign(window, { __comparisonSnapshot: snapshot });
        });
        await page.goto('/login');
        await page.goto(`/dev/dashboard-continuity?owners=1&role=${role}`);
        await page.getByRole('button', { name: 'Open Alpha Client', exact: true }).click();
        const results: unknown[] = [];
        for (let attempt = 0; attempt < 2; attempt++) {
          await page.locator('[data-dashboard-trace-control="provider-action"]').click();
          if (journey === 'view') {
            await page.getByRole('button', { name: /^View Notes?$/, exact: true }).click();
          } else {
            if (journey === 'note' && role === 'provider') await page.getByRole('button', { name: 'Update Note', exact: true }).click();
            const label = journey === 'route' ? (role === 'supervisor' ? 'Field Observation' : 'Open Active Case') : (role === 'supervisor' ? 'Clinical Note' : 'A-B-C Data');
            await page.getByRole('button', { name: label, exact: true }).click();
          }
          const workflow = page.locator('[data-dashboard-trace-layer="workflow-overlay"]');
          if (journey === 'route') await expect(page.locator('#continuity-visible-back')).toBeVisible();
          else await expect(workflow).toBeVisible();
          await expect(page.getByRole('menu', { name: 'Documentation' })).toHaveCount(0);
          await page.evaluate(() => {
            const frames: Array<Record<string, number | string | boolean>> = [];
            Object.assign(window, { __returnFrames: frames });
            const sample = () => {
              const stage = document.querySelector<HTMLElement>('.client-carousel-stage');
              frames.push({ stage: !!stage, visible: stage ? getComputedStyle(stage).visibility : 'absent',
                height: stage?.getBoundingClientRect().height ?? 0,
                ready: document.querySelectorAll('.provider-orbit-node--ready').length,
                menu: !!document.querySelector('[role="menu"][aria-label="Documentation"]'),
                workflow: !!document.querySelector('[data-dashboard-trace-layer="workflow-overlay"]') });
              if (frames.length < 90) requestAnimationFrame(sample);
            };
            sample();
          });
          if (back === 'browser') await page.goBack();
          else if (journey === 'route') await page.locator('#continuity-visible-back').click();
          else await workflow.getByRole('button', { name: /Back|Client/ }).first().click();
          await expect(workflow).toHaveCount(0);
          await expect(page.locator('[data-testid="client-orbit"]')).toBeVisible();
          await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
          const frames = await page.evaluate(async () => {
            const frames: unknown[] = [];
            for (let i = 0; i < 24; i++) {
              await new Promise(requestAnimationFrame);
              const stage = document.querySelector<HTMLElement>('.client-carousel-stage')!;
              const rect = stage.getBoundingClientRect();
              frames.push({ visible: getComputedStyle(stage).visibility, height: rect.height, width: rect.width,
                ready: document.querySelectorAll('.provider-orbit-node--ready').length,
                menu: !!document.querySelector('[role="menu"][aria-label="Documentation"]') });
            }
            (window as typeof window & { __comparisonSnapshot: (label: string) => void; __comparison: unknown[]; __returnFrames: Array<Record<string, number | string | boolean>> }).__comparisonSnapshot('returned');
            return frames;
          });
          const transitionFrames = await page.evaluate(() =>
            (window as typeof window & { __returnFrames: unknown[] }).__returnFrames);
          results.push({attempt, frames, transitionFrames});
        }
        const historyRecords = await page.evaluate(() => (window as typeof window & { __comparisonSnapshot: (label: string) => void; __comparison: unknown[]; __returnFrames: Array<Record<string, number | string | boolean>> }).__comparison);
        await testInfo.attach('sanitized-comparison', { body: JSON.stringify({ role, journey, back, history: historyRecords, results }, null, 2), contentType: 'application/json' });
        expect(errors).toEqual([]);
      });
    }
  }
}

test('overlay Forward limitation: history marker returns without workflow', async ({ page }) => {
  await syntheticServices(page);
  await page.goto('/dev/dashboard-continuity?owners=1&role=supervisor');
  await page.getByRole('button', { name: 'Open Alpha Client', exact: true }).click();
  await page.locator('[data-dashboard-trace-control="provider-action"]').click();
  await page.getByRole('button', { name: 'Clinical Note', exact: true }).click();
  await expect(page.locator('[data-dashboard-trace-layer="workflow-overlay"]')).toBeVisible();
  await page.goBack();
  await expect(page.locator('[data-dashboard-trace-layer="workflow-overlay"]')).toHaveCount(0);
  await page.goForward();
  expect(await page.evaluate(() => history.state?.autConnectDashboardOverlay)).toBe(true);
  await expect(page.locator('[data-dashboard-trace-layer="workflow-overlay"]')).toHaveCount(0);
});
