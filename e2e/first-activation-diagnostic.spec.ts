import { expect, test, type Page } from "@playwright/test";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createHmac, randomUUID } from "node:crypto";
import { hash } from "bcryptjs";
const db = new PrismaClient({ log: [] });
const actors = new Map<Page, { providerId: string; clientId: string; email: string; password: string }>();
test.afterEach(async ({ page }) => {
  const actor = actors.get(page);
  if (!actor) return;
  await db.providerClient.deleteMany({ where: { providerId: actor.providerId, clientId: actor.clientId } });
  await db.client.delete({ where: { id: actor.clientId } });
  await db.provider.delete({ where: { id: actor.providerId } });
  actors.delete(page);
});
test.afterAll(() => db.$disconnect());

function verifySchema(records: unknown[]) {
  const keys = new Set(('sequence at kind type phase target targetNode eventAt dispatchLagMs trusted defaultPrevented grid orbit providerMenu closingMenu providerBackdrop workflow guide inbox dark inertCount shells workspaceNode point expectedControls surfaces hit ancestors pointerCaptured provider supervisor present mode node category tag pointerEvents touchAction position opacity visibility display zIndex transformed inert disabled rect surface painted hitOwner ownsCenterHit callback capture label readyState performanceTypes persisted start duration').split(' '));
  const words = new Set(('installed input state logpoint listener-add listener-remove history-push history-replace popstate pageshow pagehide performance pointerdown pointerup pointercancel gotpointercapture lostpointercapture touchstart touchend touchcancel click keydown window-capture document-capture document-bubble window document other unclassified guide more inbox theme provider-plus client-list grid-client guide-dialog inbox-menu provider-menu provider-backdrop workflow more-surface carousel dock footer stage workspace shell grid orbit loading interactive complete longtask event guide-handler inbox-handler theme-handler provider-menu-handler client-list-handler grid-client-handler provider-listener-attached provider-listener-cleaned owner-effect-active HTML BODY DIV SECTION MAIN NAV BUTTON A SPAN SVG PATH INPUT TEXTAREA SELECT HEADER FORM OTHER auto none manipulation pan-y pan-x pinch-zoom visible hidden collapse static relative absolute fixed sticky block inline inline-block flex inline-flex grid inline-grid contents flow-root list-item normal').split(' '));
  const violations: string[] = [];
  const check = (value: unknown): void => {
    if (Array.isArray(value)) { value.forEach(check); return; }
    if (typeof value === 'object' && value !== null) {
      for (const [key, item] of Object.entries(value)) { if (!keys.has(key)) violations.push('unexpected key'); check(item); }
    } else if (typeof value === 'number') { if (!Number.isFinite(value)) violations.push('nonfinite number'); }
    else if (typeof value === 'string') { if (!(words.has(value) || /^-?\d+(\.\d+)?$/.test(value) || /^(pan-x|pan-y|pinch-zoom)( (pan-x|pan-y|pinch-zoom))+$/.test(value))) violations.push('unexpected enum'); }
    else if (typeof value !== 'boolean') violations.push('unexpected type');
  };
  records.forEach(check);
  expect(violations).toEqual([]);
}

test.use({ hasTouch: true, viewport: { width: 390, height: 844 }, trace: "off", video: "off", screenshot: "off" });
async function dashboard(page: Page, query = 'debugFirstActivation=1') {
  if (!['localhost', '127.0.0.1', '::1'].includes(new URL(process.env.DATABASE_URL!).hostname)) throw new Error('Diagnostic browser tests require an isolated local database.');
  const role = new URLSearchParams(query).get('role') === 'supervisor' ? 'Supervisor' : 'OccupationalTherapist';
  const email = `diagnostic-${randomUUID()}@example.test`;
  const password = `synthetic-${randomUUID()}`;
  const provider = await db.provider.create({ data: { email, passwordHash: await hash(password, 4), firstName: 'Synthetic', lastName: 'Account', role, providerRole: role } });
  const client = await db.client.create({ data: { firstName: 'Synthetic', lastName: 'Diagnostic', providerClients: { create: { providerId: provider.id, role } } } });
  actors.set(page, { providerId: provider.id, clientId: client.id, email, password });
  const payload = Buffer.from(JSON.stringify({ providerId: provider.id, role, expiresAt: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const secret = process.env.AUTH_SESSION_SECRET?.trim() ?? process.env.NEXTAUTH_SECRET?.trim();
  if (!secret) throw new Error('Local test session secret is required.');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  await page.context().addCookies([{ name: 'autconnect_session', value: `${payload}.${signature}`, url: 'http://127.0.0.1:3000', httpOnly: true, sameSite: 'Lax' }]);
  await page.goto(`/dashboard${query ? '?' + query : ''}`);
}
async function rawTap(page: Page, selector: string) {
  const { x, y, ownsHit } = await page.locator(selector).evaluate(node => {
    const box = node.getBoundingClientRect(); const x = box.x + box.width / 2, y = box.y + box.height / 2;
    return { x, y, ownsHit: node.contains(document.elementFromPoint(x, y)) };
  });
  expect(ownsHit).toBe(true);
  await page.touchscreen.tap(x, y);

}
async function advanceToExport(page: Page) {
  const elapsed = await page.evaluate(() => performance.now() - window.__autConnectFirstActivationProbe!.startedAt);
  await page.clock.fastForward(Math.max(0, 20_010 - elapsed));
  await expect(page.getByRole('button', { name: 'Copy diagnostic trace', exact: true })).toBeVisible();
}

for (const query of ['', 'debugFirstActivation=0', 'debugFirstActivation=true', 'debugFirstActivation=01', 'debugFirstActivation=1&debugFirstActivation=1']) {
  test(`ordinary/exact-flag isolation: ${query || 'absent'}`, async ({ page }) => {
    await dashboard(page, query);
    expect(await page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(false);
    await expect(page.locator('[data-first-activation-diagnostic]')).toHaveCount(0);
    await rawTap(page, '[data-dashboard-trace-control="inbox"]');
    await expect(page.getByRole('navigation', { name: 'Inbox destinations' })).toBeVisible();
  });
}

test('flagged login carries only the flag; unflagged/login/fixture paths never start capture', async ({ page }) => {
  await page.goto('/login?debugFirstActivation=1');
  await expect(page.locator('input[name="debugFirstActivation"]')).toHaveValue('1');
  expect(await page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(false);
  await page.goto('/login');
  await expect(page.locator('input[name="debugFirstActivation"]')).toHaveCount(0);
  await page.goto('/dev/provider-first-activation?debugFirstActivation=1');
  expect(await page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(false);
});

for (const role of ['occupational', 'supervisor']) for (const theme of ['light', 'dark']) {
  test(`delayed export, non-interference, copy and deletion: ${role} ${theme}`, async ({ page }) => {
    await page.clock.install();
    await page.addInitScript(theme => {
      localStorage.setItem('autconnect-theme', theme);
      Object.assign(window, { __copiedDiagnostic: '' });
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { Object.assign(window, { __copiedDiagnostic: text, __expectedDiagnosticAtCopy: JSON.stringify(window.__autConnectFirstActivationProbe!.read()) }); } } });
    }, theme);
    await dashboard(page, `debugFirstActivation=1&role=${role}`);
    await expect.poll(() => page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(true);
    const elapsed = await page.evaluate(() => performance.now() - window.__autConnectFirstActivationProbe!.startedAt);
    await page.clock.fastForward(Math.max(0, 19_000 - elapsed));
    await expect(page.locator('[data-first-activation-diagnostic]')).toHaveCount(0);
    await rawTap(page, '[data-dashboard-trace-control="inbox"]');
    await expect(page.getByRole('navigation', { name: 'Inbox destinations' })).toBeVisible();
    await rawTap(page, '[data-dashboard-trace-control="inbox"]');
    const before = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth }));
    await advanceToExport(page);
    const geometry = await page.locator('[data-first-activation-diagnostic]').evaluate(node => {
      const box = node.getBoundingClientRect();
      const other = [...document.querySelectorAll('button, a, .glass-client-badge, .glass-provider-badge')].filter(item => !node.contains(item)).map(item => item.getBoundingClientRect());
      return { pointerEvents: getComputedStyle(node).pointerEvents, left: box.left, right: box.right,
        overlap: other.some(r => r.width > 0 && r.height > 0 && r.left < box.right && r.right > box.left && r.top < box.bottom && r.bottom > box.top),
        width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth };
    });
    expect(geometry.pointerEvents).toBe('none'); expect(geometry.overlap).toBe(false);
    expect(geometry.left).toBeGreaterThanOrEqual(48); expect(geometry.right).toBeLessThanOrEqual(342);
    expect({ width: geometry.width, scroll: geometry.scroll }).toEqual(before);
    await rawTap(page, '[aria-label="Copy diagnostic trace"]');
    await expect(page.getByRole('button', { name: 'Copy diagnostic trace', exact: true })).toHaveText('Copied');
    const copied = await page.evaluate(() => (window as typeof window & { __copiedDiagnostic: string }).__copiedDiagnostic);
    const records = JSON.parse(copied);
    verifySchema(records);
    expect(records.length).toBeGreaterThan(0); expect(records.length).toBeLessThanOrEqual(600);
    expect(records.some((record: { kind: string; label: string }) => record.kind === 'logpoint' && record.label === 'inbox-handler')).toBe(true);
    expect(copied).not.toMatch(/continuity-|Synthetic|example\.test|clientId|providerId|debugFirstActivation|https?:|password|inviteToken/);
    const expectedAtCopy = await page.evaluate(() => (window as typeof window & { __expectedDiagnosticAtCopy: string }).__expectedDiagnosticAtCopy);
    expect(copied).toBe(expectedAtCopy); // Exact synchronous snapshot, not later events.
    await rawTap(page, '[data-dashboard-trace-control="theme"]');
    await rawTap(page, '[aria-label="Copy diagnostic trace"]');
    const secondCopy = await page.evaluate(() => (window as typeof window & { __copiedDiagnostic: string }).__copiedDiagnostic);
    expect(secondCopy).not.toBe(copied);
    verifySchema(JSON.parse(secondCopy));
    await page.evaluate(() => { Object.assign(window, { __retainedProbe: window.__autConnectFirstActivationProbe }); });
    await rawTap(page, '[aria-label="Stop and delete trace"]');
    await expect(page.locator('[data-first-activation-diagnostic]')).toHaveCount(0);
    expect(await page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(false);
    expect(await page.evaluate(() => (window as typeof window & { __retainedProbe: { read: () => unknown[] } }).__retainedProbe.read())).toEqual([]);
    await rawTap(page, '[data-dashboard-trace-control="inbox"]');
    await expect(page.getByRole('navigation', { name: 'Inbox destinations' })).toBeVisible();
  });
}

test('clipboard denial reveals only a bounded, selectable, explicit fallback', async ({ page }) => {
  await page.clock.install();
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw new Error('unavailable'); } } }));
  await dashboard(page);
  await expect.poll(() => page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(true);
  await expect(page.locator('[data-first-activation-diagnostic] textarea')).toHaveCount(0);
  await advanceToExport(page);
  await rawTap(page, '[aria-label="Copy diagnostic trace"]');
  const fallback = page.getByRole('textbox', { name: 'Diagnostic trace — select all to copy' });
  await expect(fallback).toBeVisible();
  expect(JSON.parse(await fallback.inputValue()).length).toBeGreaterThan(0);
  expect(await fallback.evaluate(node => ({ height: node.getBoundingClientRect().height, font: getComputedStyle(node).fontSize }))).toEqual({ height: 36, font: '16px' });
  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('TEXTAREA');
  await rawTap(page, '[aria-label="Stop and delete trace"]');
  await expect(fallback).toHaveCount(0);
});

test('standalone instrumentation is memory-only, bounded and removable even with retained API', async ({ page }) => {
  await page.goto('about:blank');
  await page.setContent('<main><button>Test control</button></main>');
  await page.evaluate(() => {
    const blocked = () => { throw new Error('diagnostic persistence/network forbidden'); };
    Storage.prototype.setItem = blocked; Storage.prototype.removeItem = blocked; Storage.prototype.clear = blocked;
    window.fetch = blocked; XMLHttpRequest.prototype.send = blocked; navigator.sendBeacon = blocked;
    Object.defineProperty(document, 'cookie', { configurable: true, set: blocked });
    Object.defineProperty(window, 'indexedDB', { configurable: true, get: blocked });
    Object.assign(window, { __beforeProbe: { add: EventTarget.prototype.addEventListener, remove: EventTarget.prototype.removeEventListener, push: history.pushState, replace: history.replaceState } });
  });
  await page.addScriptTag({ path: path.join(process.cwd(), 'diagnostics/provider-first-activation.js') });
  const result = await page.evaluate(() => {
    const probe = window.__autConnectFirstActivationProbe!;
    for (let index = 0; index < 800; index++) probe.mark('guide-handler');
    probe.mark('FORBIDDEN-RAW-INPUT');
    const exported = JSON.stringify(probe.read());
    const count = probe.read().length;
    probe.stop();
    const before = (window as typeof window & { __beforeProbe: { add: unknown; remove: unknown; push: unknown; replace: unknown } }).__beforeProbe;
    return { count, exported, remaining: probe.read(), restored: before.add === EventTarget.prototype.addEventListener && before.remove === EventTarget.prototype.removeEventListener && before.push === history.pushState && before.replace === history.replaceState };
  });
  expect(result.count).toBe(600); expect(result.remaining).toEqual([]); expect(result.restored).toBe(true);
  expect(result.exported).not.toContain('FORBIDDEN-RAW-INPUT');
});

test('real password login preserves the exact flag and starts capture before owner listener activation', async ({ page }) => {
  await dashboard(page);
  const actor = actors.get(page)!;
  await page.context().clearCookies();
  await page.goto('/login?debugFirstActivation=1');
  expect(await page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(false);
  await page.getByLabel('Email', { exact: true }).fill(actor.email);
  await page.getByLabel('Password', { exact: true }).fill(actor.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\?debugFirstActivation=1$/);
  await expect.poll(() => page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(true);
  await expect(page.locator('[data-first-activation-diagnostic]')).toHaveCount(0);
  const records = await page.evaluate(() => window.__autConnectFirstActivationProbe!.read());
  expect(records[0].kind).toBe('installed');
  expect(records.some(record => record.kind === 'listener-add' && record.type === 'popstate')).toBe(true);
  await rawTap(page, '[data-dashboard-trace-control="inbox"]');
  await expect(page.getByRole('navigation', { name: 'Inbox destinations' })).toBeVisible();
});

test('flagged grid/orbit navigation preserves capture and export remains outside controls', async ({ page }) => {
  await page.clock.install();
  await dashboard(page);
  await expect.poll(() => page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(true);
  await advanceToExport(page);
  await rawTap(page, '[data-client-grid-mode] .glass-client-badge');
  await expect(page.locator('.client-carousel-stage')).toBeVisible();
  await expect(page).toHaveURL(/debugFirstActivation=1/);
  const early = await page.evaluate(() => window.__autConnectFirstActivationProbe!.read()[0].at);
  await expect(page.getByRole('button', { name: 'Copy diagnostic trace', exact: true })).toBeVisible();
  await rawTap(page, '.dashboard-client-list-control');
  await expect(page.locator('[data-client-grid-mode]')).toBeVisible();
  expect(await page.evaluate(() => window.__autConnectFirstActivationProbe!.read()[0].at)).toBe(early);
  await expect(page).toHaveURL(/debugFirstActivation=1/);
});

for (const width of [320, 375, 1280]) {
  test(`export occupies only free space at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.clock.install();
    await dashboard(page);
    await expect.poll(() => page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(true);
    await advanceToExport(page);
    const geometry = await page.locator('[data-first-activation-diagnostic]').evaluate(node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, scrollWidth: document.documentElement.scrollWidth, width: document.documentElement.clientWidth };
    });
    expect(geometry.left).toBeGreaterThanOrEqual(48);
    expect(geometry.right).toBeLessThanOrEqual(width - 48);
    expect(geometry.scrollWidth).toBe(geometry.width);
    await rawTap(page, '[aria-label="Stop and delete trace"]');
    await expect(page.locator('[data-first-activation-diagnostic]')).toHaveCount(0);
  });
}

test('leaving the flagged dashboard stops capture and removes the export layer', async ({ page }) => {
  await dashboard(page);
  await expect.poll(() => page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(true);
  await page.evaluate(() => Object.assign(window, { __retainedProbe: window.__autConnectFirstActivationProbe }));
  await rawTap(page, '[data-dashboard-trace-control="inbox"]');
  await page.getByRole('link', { name: /My Organization Invitations/ }).click();
  await expect(page).toHaveURL(/\/portal\/organization\/invitations$/);
  expect(await page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(false);
  await expect(page.locator('[data-first-activation-diagnostic]')).toHaveCount(0);
  expect(await page.evaluate(() => (window as typeof window & { __retainedProbe: { read: () => unknown[] } }).__retainedProbe.read())).toEqual([]);
});

test('removing the flag on the same dashboard deletes capture', async ({ page }) => {
  await page.clock.install();
  await dashboard(page);
  await expect.poll(() => page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(true);
  await advanceToExport(page);
  await page.evaluate(() => history.replaceState(history.state, '', '/dashboard'));
  await expect.poll(() => page.evaluate(() => !!window.__autConnectFirstActivationProbe)).toBe(false);
  await expect(page.locator('[data-first-activation-diagnostic]')).toHaveCount(0);

});
