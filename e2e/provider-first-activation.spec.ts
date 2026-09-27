import { expect, test, type Page, type Locator } from "@playwright/test";
import path from "node:path";


async function rawTap(page: Page, selector: string | Locator) {
  // Exactly one input dispatch. No Locator.click/tap actionability retries and
  // no warm-up click. Inspect the actual point before input, rather than forcing
  // a DOM click through an obstructing element.
  const point = await (typeof selector === "string" ? page.locator(selector) : selector).evaluate(node => {
    const box = node.getBoundingClientRect();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    return { x, y, unobstructed: node.contains(document.elementFromPoint(x, y)) };
  });
  expect(point.unobstructed, `hit testing ${selector}`).toBe(true);
  await page.touchscreen.tap(point.x, point.y);
}
async function fresh(page: Page, role: string, orbit = false) {
  await page.addInitScript({ path: path.join(process.cwd(), "diagnostics/provider-first-activation.js") });
  await page.route("**/api/**", route => route.fulfill({ json: { ok: true } }));
  await page.goto(`/dev/provider-first-activation?role=${role}${orbit ? "&orbit=1" : ""}`, { waitUntil: "domcontentloaded" });
}
async function singleUtility(page: Page, utility: string) {
  const selector = utility === "guide" ? '.dashboard-info-control' : `[data-dashboard-trace-control="${utility}"]`;
  const previousTheme = await page.locator('html').evaluate(node => node.classList.contains('dark'));
  await rawTap(page, selector);
  if (utility === "guide") await expect(page.getByRole('dialog', { name: 'Using AutConnect' })).toBeVisible();
  if (utility === "inbox") await expect(page.getByRole('navigation', { name: 'Inbox destinations' })).toBeVisible();
  if (utility === "theme") await expect.poll(() => page.locator('html').evaluate(node => node.classList.contains('dark'))).toBe(!previousTheme);
  if (utility === "more") await expect(page.locator(selector)).toHaveAttribute('aria-expanded', 'true');
}

test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

for (const [role, utilities] of [["occupational", ["guide", "inbox", "theme"]], ["supervisor", ["more", "inbox", "theme"]]] as const) {
  for (const orbit of [false, true]) for (const utility of utilities) {
    test(`${role} initial ${orbit ? 'orbit' : 'grid'}: first raw ${utility} tap`, async ({ page }, info) => {
      const errors: string[] = [];
      page.on('pageerror', error => errors.push(error.name));
      await fresh(page, role, orbit);
      try {
        await expect(page.locator('.dashboard-workspace-layout')).toBeVisible();
        await singleUtility(page, utility);
        const events = await page.evaluate(() => window.__autConnectFirstActivationProbe!.read());
        const clicks = events.filter(event => event.kind === 'input' && event.type === 'click' && event.phase === 'document-capture');
        expect(clicks).toHaveLength(1);
        expect(clicks[0].target).toBe(utility);
        expect(clicks[0].trusted).toBe(true);
        expect(clicks[0].inertCount).toBe(0);
        expect(errors).toEqual([]);
      } finally {
        await info.attach('sanitized-first-tap-timeline', { body: JSON.stringify(await page.evaluate(() => window.__autConnectFirstActivationProbe?.read() ?? [])), contentType: 'application/json' });
      }
    });
  }
}

test('Occupational Therapist: grid/orbit transitions and first plus tap need no utility warm-up', async ({ page }, info) => {
  await fresh(page, 'occupational');
  try {
    await expect(page.locator('[data-client-grid-mode]')).toBeVisible();
    await rawTap(page, '[data-client-grid-mode] .glass-client-badge[aria-label="Open Alpha Client"]');
    await expect(page.locator('.client-carousel-stage')).toBeVisible();
    await rawTap(page, '[data-dashboard-trace-control="provider-action"]');
    await expect(page.getByRole('menu', { name: 'Documentation' })).toBeVisible();
    // Actual menu contents prove the Occupational Therapist role reached the real owner.
    await expect(page.getByRole('button', { name: 'Sensory Observation', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.provider-action-menu')).toHaveCount(0);
    await rawTap(page, '.dashboard-client-list-control');
    await expect(page.locator('[data-client-grid-mode]')).toBeVisible();
    await singleUtility(page, 'inbox');
    const timeline = await page.evaluate(() => window.__autConnectFirstActivationProbe!.read());
    expect(timeline.some(item => item.kind === 'history-push')).toBe(true);
    expect(timeline.some(item => item.kind === 'popstate')).toBe(true);
    expect(timeline.some(item => item.kind === 'listener-add' && item.type === 'popstate')).toBe(true);
  } finally {
    await info.attach('sanitized-transition-timeline', { body: JSON.stringify(await page.evaluate(() => window.__autConnectFirstActivationProbe?.read() ?? [])), contentType: 'application/json' });
  }
});

for (const control of ['provider-action', 'client-list']) {
  test(`Occupational Therapist direct orbit: first raw ${control} tap`, async ({ page }, info) => {
    await fresh(page, 'occupational', true);
    try {
      await expect(page.locator('.client-carousel-stage')).toBeVisible();
      await rawTap(page, `[data-dashboard-trace-control="${control}"]`);
      if (control === 'provider-action') await expect(page.getByRole('menu', { name: 'Documentation' })).toBeVisible();
      else await expect(page.locator('[data-client-grid-mode]')).toBeVisible();
    } finally {
      await info.attach('sanitized-first-orbit-timeline', { body: JSON.stringify(await page.evaluate(() => window.__autConnectFirstActivationProbe?.read() ?? [])), contentType: 'application/json' });
    }
  });
}
