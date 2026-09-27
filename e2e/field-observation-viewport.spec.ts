import { expect, test, type Page } from "@playwright/test";
import { writeFile } from "node:fs/promises";

async function measure(page: Page, stage: string) {
  return page.evaluate((stage) => {
    const root = document.documentElement;
    const vv = visualViewport;
    const active = document.activeElement;
    const box = (node: Element) => {
      const rect = node.getBoundingClientRect();
      const css = getComputedStyle(node);
      return { tag: node.tagName, width: rect.width, left: rect.left, right: rect.right,
        cssWidth: css.width, minWidth: css.minWidth, transform: css.transform,
        position: css.position, overflowX: css.overflowX };
    };
    const outside = [...document.body.querySelectorAll("*")].filter(node => {
      const rect = node.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1 && (rect.right > root.clientWidth + 1 || rect.left < -1);
    });
    const surfaces = [".app-user-header", ".client-orbit-canvas", ".dashboard-utility-controls",
      '[role="menu"]', '[data-dashboard-trace-layer="workflow-overlay"]', "#field-observation-form", '[role="dialog"]']
      .flatMap(selector => [...document.querySelectorAll(selector)].map(node => ({ selector, ...box(node) })));
    return { stage, layoutWidth: root.clientWidth, innerWidth, rootScrollWidth: root.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      visual: vv ? { width: vv.width, scale: vv.scale, left: vv.offsetLeft, top: vv.offsetTop } : null,
      viewportMeta: [...document.querySelectorAll('meta[name="viewport"]')].map(node => node.getAttribute("content")),
      focus: active ? { tag: active.tagName, type: active.getAttribute("type"), fontSize: getComputedStyle(active).fontSize } : null,
      overflowCandidates: outside.slice(0, 12).map(box), surfaces,
      staleWorkflowAncestor: !!document.querySelector('.client-orbit-canvas')?.closest('#field-observation-form, [role="dialog"]'),
    };
  }, stage);
}

for (const width of [375, 390, 760, 768, 1280]) {
  test(`observation submit viewport and typography at ${width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width >= 768 ? 1024 : 844 });
    const measurements: Awaited<ReturnType<typeof measure>>[] = [];
    const fonts: Array<{ control: string; size: number }> = [];
    let submissions = 0;
    const snapshot = async (stage: string) => {
      const result = await measure(page, stage);
      measurements.push(result);
      expect.soft(result.rootScrollWidth, stage).toBeLessThanOrEqual(result.layoutWidth + 1);
      expect.soft(result.bodyScrollWidth, stage).toBeLessThanOrEqual(result.layoutWidth + 1);
      expect.soft(result.staleWorkflowAncestor, stage).toBe(false);
      expect.soft(result.viewportMeta).toEqual(["width=device-width, initial-scale=1"]);
      for (const surface of result.surfaces) {
        expect.soft(surface.left, `${stage} ${surface.selector}`).toBeGreaterThanOrEqual(-1);
        expect.soft(surface.right, `${stage} ${surface.selector}`).toBeLessThanOrEqual(result.layoutWidth + 1);
      }
    };
    await page.route("**/*", async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "POST" && request.headers()["next-action"] && url.pathname.startsWith("/portal/supervisor/field-observation/")) {
        submissions++;
        measurements.push(await measure(page, `submit-request-${submissions}`));
        // Resolve the real client-side server-action call without writing data.
        return route.fulfill({ contentType: "text/x-component", body: '0:{"a":"$@1","f":[],"b":""}\n1:{"ok":true}\n' });
      }
      if (request.method() !== "GET") return route.fulfill({ json: { ok: true } });
      if (url.pathname === "/api/notes/form-data") return route.fulfill({ json: {
        clientId: "continuity-client-a", role: "Supervisor", providerId: "continuity-supervisor",
        clientName: "Alpha Client", providerName: "Synthetic Supervisor", providerRole: "Supervisor",
        targetOptions: [], noteKind: "ClinicalNote", mode: "create", draft: null, draftWorkflowKey: "ClinicalNote",
      } });
      if (url.pathname.startsWith("/api/")) return route.fulfill({ json: { ok: true } });
      if (url.pathname.startsWith("/portal/supervisor/field-observation/") || url.pathname === "/dashboard") {
        const query = new URLSearchParams(url.search);
        query.set("viewport", "1");
        let destination = "/dev/dashboard-continuity";
        if (url.pathname.startsWith("/portal/supervisor/field-observation/")) {
          destination += "/workflow";
          query.set("form", "field");
        } else {
          query.set("owners", "1"); query.set("orbit", "1");
        }
        const response = await route.fetch({ url: `${url.origin}${destination}?${query}` });
        return route.fulfill({ response });
      }
      return route.continue();
    });
    const openMenu = async () => {
      await page.getByRole("button", { name: "Add your note", exact: true }).click();
      await expect(page.getByRole("menu", { name: "Documentation" })).toBeVisible();
    };
    const clinical = async (stage: string) => {
      await openMenu();
      await page.getByRole("button", { name: "Clinical Note", exact: true }).click();
      await expect(page.getByRole("button", { name: "Team", exact: true })).toBeVisible();
      await snapshot(stage);
      await page.goBack();
      await expect(page.locator('[data-testid="client-orbit"]')).toBeVisible();
    };
    const focus = async (control: string, locator: ReturnType<Page["locator"]>) => {
      await locator.focus();
      fonts.push({ control, size: await locator.evaluate(node => Number.parseFloat(getComputedStyle(node).fontSize)) });
      await snapshot(`focus-${control}`);
    };
    try {
      await page.goto("/dev/dashboard-continuity?owners=1&viewport=1");
      await page.getByRole("button", { name: "Open Alpha Client", exact: true }).click();
      await snapshot("fresh-orbit");
      await clinical("clinical-before");
      for (let attempt = 1; attempt <= 2; attempt++) {
        await openMenu();
        await snapshot(`menu-${attempt}`);
        await page.getByRole("button", { name: "Field Observation", exact: true }).click();
        await expect(page.getByRole("heading", { name: "Observation details" })).toBeVisible();
        const pageHeading = page.getByRole("heading", { name: "Field Observation", exact: true });
        await expect(pageHeading).toHaveCount(1);
        const headingBox = await pageHeading.boundingBox();
        expect(headingBox?.height).toBe(1);
        expect(headingBox?.width).toBe(1);
        await snapshot(`form-${attempt}`);
        await focus("provider-select", page.getByLabel("Observed provider"));
        await page.getByLabel("Observed provider").selectOption({ index: 1 });
        await focus("date-time", page.getByLabel("Date and time"));
        await focus("setting-select", page.getByRole("combobox", { name: /^Setting/ }));
        await page.getByRole("combobox", { name: /^Setting/ }).selectOption("CLINIC");
        await focus("duration", page.getByLabel("Optional duration"));
        await page.getByLabel("Optional duration").fill("20");
        await page.getByRole("button", { name: "Next Field Observation card" }).click();
        await page.getByText("Implemented", { exact: true }).click();
        await focus("rating-radio", page.locator('input[type="radio"]').first());
        for (let step = 0; step < 8; step++) await page.getByRole("button", { name: "Next Field Observation card" }).click();
        await focus("card-summary", page.locator("#field-observation-form textarea"));
        await page.locator("#field-observation-form textarea").fill("Synthetic viewport check.");
        await page.getByRole("button", { name: "Finish", exact: true }).click();
        await focus("dialog-summary", page.getByRole("dialog").locator("textarea"));
        await page.getByRole("button", { name: "Save observation", exact: true }).click();
        await expect(page.locator('[data-testid="client-orbit"]')).toBeVisible();
        await expect(page).toHaveURL(/clientId=continuity-client-a&view=orbit/);
        await expect(page.locator("#field-observation-form")).toHaveCount(0);
        await snapshot(`returned-${attempt}`);
        await clinical(`clinical-after-${attempt}`);
      }
      expect(submissions).toBe(2);
      await page.reload();
      await expect(page.locator('[data-testid="client-orbit"]')).toBeVisible();
      await snapshot("refreshed-orbit");
      for (const font of fonts.filter(font => font.control !== "rating-radio")) {
        if (width <= 760) expect.soft(font.size, font.control).toBeGreaterThanOrEqual(16);
        else expect.soft(font.size, font.control).toBeCloseTo(13.92, 1);
      }
    } finally {
      const evidence = JSON.stringify({ width, engine: info.project.name, submissions, fonts, measurements }, null, 2);
      await writeFile(info.outputPath("viewport-measurements.json"), evidence);
      await info.attach("viewport-measurements", { body: evidence, contentType: "application/json" });
    }
  });
}
