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

async function activate(page: Page, selector: string) {
  const control = page.locator(selector);
  if (await page.evaluate(() => navigator.maxTouchPoints > 0)) await control.tap();
  else await control.click();
}

async function utilities(page: Page) {
  const more = page.locator('[data-dashboard-trace-control="more"]');
  if (await more.count()) {
    await activate(page, '[data-dashboard-trace-control="more"]');
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await activate(page, '[data-dashboard-trace-control="more"]');
    await expect(more).toHaveAttribute("aria-expanded", "false");
  }
  await activate(page, '[data-dashboard-trace-control="inbox"]');
  await expect(page.getByRole("navigation", { name: "Inbox destinations" })).toBeVisible();
  await activate(page, '[data-dashboard-trace-control="inbox"]');
  await expect(page.getByRole("navigation", { name: "Inbox destinations" })).toHaveCount(0);
  const theme = page.locator('[data-dashboard-trace-control="theme"]');
  const before = await theme.getAttribute("aria-pressed");
  await activate(page, '[data-dashboard-trace-control="theme"]');
  await expect(theme).toHaveAttribute("aria-pressed", before === "true" ? "false" : "true");
}

for (const role of ["supervisor", "provider"]) {
  test(`${role}: actual owner first/repeat utilities and closed menu across overlay returns`, async ({ page }) => {
    const errors = await syntheticServices(page);
    await page.goto(`/dev/dashboard-continuity?owners=1&role=${role}&debugInteractions=1`);
    await utilities(page);
    await page.getByRole("button", { name: /Alpha Client/ }).click();
    await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
    const menu = page.locator('[role="menu"][aria-label="Documentation"]');
    for (const visibleBack of [false, true, false]) {
      await activate(page, '[data-dashboard-trace-control="provider-action"]');
      if (role === "provider") await page.getByRole("button", { name: "Update Note", exact: true }).click();
      await page.getByRole("button", { name: role === "provider" ? "A-B-C Data" : "Clinical Note", exact: true }).click();
      const workflow = page.locator('[data-dashboard-trace-layer="workflow-overlay"]');
      await expect(workflow).toBeVisible();
      await expect(menu).toHaveCount(0);
      await expect(page.locator('[data-dashboard-trace-control="theme"]')).toHaveCount(0);
      if (role === "supervisor") {
        const team = page.getByRole("button", { name: "Team", exact: true });
        page.once("dialog", (dialog) => dialog.dismiss());
        await activate(page, '[data-dashboard-trace-control="visibility-team"]');
        await expect(team).toHaveAttribute("aria-pressed", "false");
        page.once("dialog", (dialog) => dialog.accept());
        await activate(page, '[data-dashboard-trace-control="visibility-team"]');
        await expect(team).toHaveAttribute("aria-pressed", "true");
        await page.getByRole("button", { name: "Private", exact: true }).click();
      }
      // Observe every DOM mutation during return, including short-lived exit layers.
      await page.evaluate(() => {
        const seen: string[] = [];
        Object.assign(window, { __returnMenus: seen });
        const observer = new MutationObserver(() => {
          if (document.querySelector('[role="menu"][aria-label="Documentation"]')) seen.push("mounted");
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true });
      });
      if (visibleBack) await workflow.getByRole("button", { name: /Back|Client/, exact: false }).first().click();
      else await page.goBack();
      await expect(workflow).toHaveCount(0);
      await expect(menu).toHaveCount(0);
      expect(await page.evaluate(() => (window as typeof window & { __returnMenus: string[] }).__returnMenus)).toEqual([]);
      await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
      await utilities(page);
    }
    const events = await page.evaluate(() => window.__autConnectDashboardTrace?.read() ?? []);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "state", state: "inbox-open" }),
      expect.objectContaining({ kind: "state", state: "documentation-closed" }),
    ]));
    expect(errors).toEqual([]);
  });
}

for (const role of ["supervisor", "provider"]) {
  test(`${role}: route control return, Forward and Client isolation`, async ({ page }) => {
    const errors = await syntheticServices(page);
    await page.goto(`/dev/dashboard-continuity?owners=1&role=${role}`);
    await page.getByRole("button", { name: "Open Alpha Client", exact: true }).click();
    await activate(page, '[data-dashboard-trace-control="provider-action"]');
    await page.getByRole("button", { name: role === "supervisor" ? "Field Observation" : "Open Active Case", exact: true }).click();
    await expect(page.locator("#continuity-visible-back")).toBeVisible();
    await expect(page).toHaveURL(role === "supervisor" ? /\/portal\/supervisor\/field-observation\/continuity-client-a/ : /\/portal\/case-support\/continuity-client-a/);
    await page.goBack();
    await expect(page.locator('[data-testid="client-orbit"]')).toBeVisible();
    await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
    await expect(page.getByRole("menu", { name: "Documentation" })).toHaveCount(0);
    await page.goForward();
    await expect(page.locator("#continuity-visible-back")).toBeVisible();
    await page.locator("#continuity-visible-back").click();
    await expect(page.locator('[data-testid="client-orbit"]')).toBeVisible();
    await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
    await page.getByRole("button", { name: "Next client", exact: true }).click();
    await expect(page).toHaveURL(/clientId=continuity-client-b&view=orbit/);
    await expect(page.getByRole("menu", { name: "Documentation" })).toHaveCount(0);
    await page.getByRole("button", { name: "Previous client", exact: true }).click();
    await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
    await page.getByRole("button", { name: "Client List", exact: true }).click();
    await expect(page.getByRole("button", { name: "Open Alpha Client", exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/dashboard$/);
    await page.goForward();
    await expect(page.locator('[data-testid="client-orbit"]')).toBeVisible();
    await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
    expect(errors).toEqual([]);
  });
}

for (const role of ["supervisor", "provider"]) {
  test(`${role}: interior touch swipe changes Client while edge start stays reserved`, async ({ page }) => {
    const errors = await syntheticServices(page);
    await page.goto(`/dev/dashboard-continuity?owners=1&role=${role}`);
    await page.getByRole("button", { name: "Open Alpha Client", exact: true }).click();
    const stage = page.locator(".client-carousel-stage");
    const box = await stage.boundingBox();
    expect(box).not.toBeNull();
    const { width, height } = page.viewportSize()!;
    const y = Math.min(box!.y + box!.height - 30, height - 130);
    const session = await page.context().newCDPSession(page);
    const swipe = async (from: number, to: number) => {
      await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: from, y }] });
      for (let step = 1; step <= 8; step++) {
        await session.send("Input.dispatchTouchEvent", {
          type: "touchMove", touchPoints: [{ x: from + (to - from) * step / 8, y }],
        });
      }
      await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    };
    await swipe(width - 8, width - 150);
    await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
    await swipe(width * 0.7, width * 0.3);
    await expect(page).toHaveURL(/clientId=continuity-client-b&view=orbit/);
    await swipe(width * 0.3, width * 0.7);
    await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
    expect(errors).toEqual([]);
  });
}
