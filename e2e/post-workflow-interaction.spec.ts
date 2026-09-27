import { expect, test, type Page } from "@playwright/test";

// Synthetic data only. Exercise real dashboard owners and the real observation
// form, but never send a mutation or acknowledge a real note.
async function isolateServices(page: Page) {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== "GET") return route.fulfill({ status: 200, body: '{"ok":true}' });
    if (url.pathname === "/api/notes/form-data") return route.fulfill({ json: {
      clientId: "continuity-client-a", role: "Supervisor", providerId: "continuity-supervisor",
      clientName: "Alpha Client", providerName: "Sam Lead", providerRole: "Supervisor",
      targetOptions: [], noteKind: "ClinicalNote", mode: "create", draft: null,
      draftWorkflowKey: "ClinicalNote",
    } });
    if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { ok: true } });
    if (url.pathname.startsWith("/portal/")) {
      const query = new URLSearchParams(url.search);
      if (url.pathname.includes("field-observation")) query.set("form", "field");
      const response = await route.fetch({ url: `${url.origin}/dev/dashboard-continuity/workflow?${query}` });
      return route.fulfill({ response });
    }
    return route.continue();
  });
}

async function activate(page: Page, control: string) {
  const trigger = page.locator(`[data-dashboard-trace-control="${control}"]`).filter({ visible: true });
  // Inspect before Playwright's actionability wait could conceal an obstruction.
  const hit = await trigger.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
    return { matches: element.contains(target), tag: target?.tagName, classes: target?.getAttribute("class") };
  });
  await test.info().attach(`hit-${control}`, { body: JSON.stringify(hit), contentType: "application/json" });
  if (test.info().project.use.hasTouch) await trigger.tap();
  else await trigger.click();
}

async function checkUtilities(page: Page) {
  await activate(page, "more");
  await expect(page.getByRole("dialog", { name: "Dashboard actions" })).toBeVisible();
  await activate(page, "more");
  await expect(page.getByRole("dialog", { name: "Dashboard actions" })).toHaveCount(0);
  await activate(page, "inbox");
  await expect(page.getByRole("navigation", { name: "Inbox destinations" })).toBeVisible();
  await activate(page, "inbox");
  await expect(page.getByRole("navigation", { name: "Inbox destinations" })).toHaveCount(0);
}

for (const workflow of ["Field Observation", "Case Support", "View Notes"]) {
  for (const back of ["browser", "visible"]) {
    test(`${workflow}: ${back} return leaves controls usable five times`, async ({ page }) => {
      await isolateServices(page);
      const errors: string[] = [];
      page.on("pageerror", error => errors.push(error.name));
      await page.goto("/dev/dashboard-continuity?owners=1&debugInteractions=1");
      await page.getByRole("button", { name: "Open Alpha Client", exact: true }).click();
      await checkUtilities(page);
      const menu = page.getByRole("menu", { name: "Documentation" });
      for (let attempt = 0; attempt < 5; attempt++) {
        await activate(page, "provider-action");
        await expect(menu).toBeVisible();
        await page.getByRole("button", { name: workflow, exact: true }).click();
        if (workflow === "Field Observation") await expect(page.getByRole("heading", { name: "Field Observation", exact: true })).toBeVisible();
        else if (workflow === "Case Support") await expect(page.locator("#continuity-visible-back")).toBeVisible();
        else await expect(page.locator('[data-dashboard-trace-layer="workflow-overlay"]')).toBeVisible();
        if (back === "browser") await page.goBack();
        else if (workflow === "Field Observation") await page.getByRole("link", { name: "Back", exact: true }).click();
        else if (workflow === "Case Support") await page.locator("#continuity-visible-back").click();
        else await page.locator('[data-dashboard-trace-layer="workflow-overlay"]').getByRole("button", { name: /Back|Client/ }).first().click();
        await expect(page.locator('[data-testid="client-orbit"]')).toBeVisible();
        await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
        await expect(page.locator('[data-dashboard-trace-layer="provider-backdrop"]')).toHaveCount(0);
        await page.evaluate(() => window.__autConnectDashboardTrace?.clear());
        await activate(page, "provider-action");
        await expect(menu).toBeVisible();
        await expect(menu).not.toHaveAttribute("inert");
        expect(await page.evaluate(() => window.__autConnectDashboardTrace?.read())).toEqual(
          expect.arrayContaining([expect.objectContaining({ kind: "handler", target: "provider-action" })])
        );
        await page.getByRole("button", { name: "Close documentation menu", exact: true }).click({ position: { x: 5, y: 5 } });
        await expect(menu).toHaveCount(0);
        await checkUtilities(page);
      }
      expect(errors).toEqual([]);
    });
  }
}

test("Clinical Note Team confirmation repeatedly accepts and cancels independently", async ({ page }) => {
  await isolateServices(page);
  await page.goto("/dev/dashboard-continuity?owners=1");
  await page.getByRole("button", { name: "Open Alpha Client", exact: true }).click();
  await activate(page, "provider-action");
  await page.getByRole("button", { name: "Clinical Note", exact: true }).click();
  const team = page.getByRole("button", { name: "Team", exact: true });
  const privateButton = page.getByRole("button", { name: "Private", exact: true });
  let confirmations = 0;
  page.on("dialog", async dialog => {
    confirmations++;
    if (confirmations % 2) await dialog.dismiss();
    else await dialog.accept();
  });
  for (let i = 0; i < 5; i++) {
    await team.click();
    await expect(privateButton).toHaveAttribute("aria-pressed", "true");
    await team.click();
    await expect(team).toHaveAttribute("aria-pressed", "true");
    await privateButton.click();
  }
  expect(confirmations).toBe(10);
});
