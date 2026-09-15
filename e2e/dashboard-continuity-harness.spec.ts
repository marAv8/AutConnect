import { expect, test, type Page } from "@playwright/test";

type Frame = {
  visibility: string;
  readyProviders: number;
  visibleMasks: number;
  orbitWidth: number;
  orbitLeft: number;
  centerLeft: number;
  stageCenter: number;
  orbitCenter: number;
};

async function installFrameSampler(page: Page) {
  await page.addInitScript(() => {
    const start = () => {
      const frames: Array<Record<string, number | string>> = [];
      Object.defineProperty(window, "__continuityFrames", {
        value: frames,
        configurable: true,
      });
      const sample = () => {
      const slide = document.querySelector<HTMLElement>(
        ".client-carousel-stage > div:last-child"
      );
      const orbit = document.querySelector<HTMLElement>(".client-orbit-canvas");
      const center = document.querySelector<HTMLElement>(".glass-client-badge");
      const stage = document.querySelector<HTMLElement>(".client-carousel-stage");
      const renderedStyles = slide ? getComputedStyle(slide) : null;
      // Stylesheets are render-blocking; ignore parsed-but-unstyled DOM that
      // cannot be painted as the Dashboard surface.
      if (
        slide &&
        orbit &&
        center &&
        stage &&
        renderedStyles?.display === "flex"
      ) {
        const orbitRect = orbit.getBoundingClientRect();
        const centerRect = center.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        frames.push({
          visibility: getComputedStyle(slide).visibility,
          readyProviders: document.querySelectorAll(
            ".provider-orbit-node--ready"
          ).length,
          visibleMasks: [...document.querySelectorAll<HTMLElement>(
            ".provider-badge-reveal-layer"
          )].filter((node) => Number(getComputedStyle(node).opacity) > 0.01)
            .length,
          orbitWidth: orbitRect.width,
          orbitLeft: orbitRect.left,
          centerLeft: centerRect.left,
          stageCenter: stageRect.left + stageRect.width / 2,
          orbitCenter: orbitRect.left + orbitRect.width / 2,
        });
      }
      if (frames.length < 24) requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
    };
    Object.defineProperty(window, "__startContinuitySampling", {
      value: start,
      configurable: true,
    });
    start();
  });
}

async function readFrames(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          ((window as typeof window & { __continuityFrames?: Frame[] })
            .__continuityFrames?.length ?? 0)
      )
    )
    .toBe(24);
  return page.evaluate(
    () =>
      (window as typeof window & { __continuityFrames: Frame[] })
        .__continuityFrames
  );
}

function expectContinuousReturn(frames: Frame[]) {
  expect(frames.every((frame) => frame.visibility === "visible")).toBe(true);
  expect(frames.every((frame) => frame.readyProviders === 0)).toBe(true);
  expect(frames.every((frame) => frame.visibleMasks === 0)).toBe(true);
  expect(Math.max(...frames.map((frame) => frame.orbitWidth)) - Math.min(...frames.map((frame) => frame.orbitWidth))).toBeLessThan(1);
  expect(Math.max(...frames.map((frame) => frame.orbitLeft)) - Math.min(...frames.map((frame) => frame.orbitLeft))).toBeLessThan(1);
  expect(Math.max(...frames.map((frame) => frame.centerLeft)) - Math.min(...frames.map((frame) => frame.centerLeft))).toBeLessThan(1);
  expect(
    frames.every(
      (frame) => Math.abs(frame.orbitCenter - frame.stageCenter) < 0.5
    )
  ).toBe(true);
}

function expectSettledReload(frames: Frame[]) {
  expect(frames.every((frame) => frame.visibility === "visible")).toBe(true);
  expect(frames.every((frame) => frame.readyProviders === 0)).toBe(true);
  expect(frames.every((frame) => frame.visibleMasks === 0)).toBe(true);
  expect(
    frames.every(
      (frame) => Math.abs(frame.orbitCenter - frame.stageCenter) < 0.5
    )
  ).toBe(true);
  expectContinuousReturn(frames.slice(-8));
}

function captureRelevantConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /script tag while rendering React|hydration|uncaught/i.test(message.text())
    ) {
      errors.push(message.text());
    }
  });
  return () => expect(errors).toEqual([]);
}

test("an exact returned Client paints visible and settled across repeated remounts and resizing", async ({
  page,
}) => {
  const expectNoConsoleErrors = captureRelevantConsoleErrors(page);
  await installFrameSampler(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dev/dashboard-continuity");
  await page.locator("#prepare-continuity-return").click();
  await expect(page).toHaveURL(/\/dev\/dashboard-continuity\/workflow$/);
  await page.evaluate(() =>
    (window as typeof window & { __startContinuitySampling: () => void })
      .__startContinuitySampling()
  );
  await page.goBack();
  expectContinuousReturn(await readFrames(page));

  await page.goForward();
  await expect(page).toHaveURL(/\/dev\/dashboard-continuity\/workflow$/);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() =>
    (window as typeof window & { __startContinuitySampling: () => void })
      .__startContinuitySampling()
  );
  await page.locator("#continuity-visible-back").click();
  expectContinuousReturn(await readFrames(page));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expectSettledReload(await readFrames(page));
  expectNoConsoleErrors();
});

test("Notifications stays centered in the visible viewport above the utility dock", async ({
  page,
}) => {
  const expectNoConsoleErrors = captureRelevantConsoleErrors(page);
  await page.goto("/dev/dashboard-continuity");

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(viewport);
    const trigger = page.getByRole("button", {
      name: "Case Support requests and inbox",
    });
    if ((await trigger.getAttribute("aria-expanded")) !== "true") {
      await trigger.click();
    }
    const menu = page.getByRole("navigation", { name: "Inbox destinations" });
    await expect(menu).toBeVisible();
    const boxes = await page.evaluate(() => {
      const panel = document.querySelector(".dashboard-inbox-menu")!.getBoundingClientRect();
      const button = document.querySelector(".dashboard-case-support-control")!.getBoundingClientRect();
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      return {
        centerDelta: panel.left + panel.width / 2 - viewportWidth / 2,
        left: panel.left,
        right: viewportWidth - panel.right,
        gapAboveDock: button.top - panel.bottom,
      };
    });
    expect(Math.abs(boxes.centerDelta)).toBeLessThan(0.5);
    expect(boxes.left).toBeGreaterThanOrEqual(15);
    expect(boxes.right).toBeGreaterThanOrEqual(15);
    expect(boxes.gapAboveDock).toBeGreaterThanOrEqual(15);
  }
  expectNoConsoleErrors();
});

test("Clinical Reflection Team selection receives activation and remains controlled", async ({
  page,
}, testInfo) => {
  const expectNoConsoleErrors = captureRelevantConsoleErrors(page);
  await page.route("**/api/notes/form-data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clientId: "continuity-client-a",
        role: "Supervisor",
        providerId: "continuity-supervisor",
        clientName: "Alpha Client",
        providerName: "Sam Lead",
        providerRole: "Supervisor",
        targetOptions: [],
        noteKind: "ClinicalNote",
        mode: "create",
        draft: null,
        draftWorkflowKey: "ClinicalNote",
      }),
    });
  });
  await page.goto("/dev/dashboard-continuity?debugInteractions=1");
  await page.getByRole("button", { name: "Add your note" }).click();
  await page.getByRole("button", { name: "Clinical Note", exact: true }).click();
  const team = page.getByRole("button", { name: "Team", exact: true });
  await expect(team).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  if (testInfo.project.name === "older-phone-chromium") {
    await team.tap();
  } else {
    await team.click();
  }
  await expect(team).toHaveAttribute("aria-pressed", "true");
  await page.waitForTimeout(150);
  await expect(team).toHaveAttribute("aria-pressed", "true");
  const interactionEvents = await page.evaluate(
    () => window.__autConnectDashboardTrace?.read() ?? []
  );
  expect(interactionEvents).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ kind: "handler", target: "visibility-team" }),
      expect.objectContaining({ kind: "state", state: "visibility-team" }),
    ])
  );
  expectNoConsoleErrors();
});

test("same-page note launch finishes the provider-menu exit before history changes", async ({
  page,
}) => {
  await page.route("**/api/notes/form-data**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        clientId: "continuity-client-a",
        role: "Supervisor",
        providerId: "continuity-supervisor",
        clientName: "Alpha Client",
        providerName: "Sam Lead",
        providerRole: "Supervisor",
        targetOptions: [],
        noteKind: "ClinicalNote",
        mode: "create",
        draft: null,
        draftWorkflowKey: "ClinicalNote",
      }),
    });
  });
  await page.goto("/dev/dashboard-continuity");
  await page.getByRole("button", { name: "Add your note" }).click();
  await page.getByRole("button", { name: "Clinical Note", exact: true }).click();

  const menu = page.locator('[role="menu"][aria-label="Documentation"]');
  await expect(menu).toHaveClass(/provider-action-menu--closing/);
  await expect(menu).toHaveAttribute("inert", "");
  await expect(menu).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByRole("button", { name: "Team", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Team", exact: true })).toBeVisible();
  await expect(menu).toHaveCount(0);

  await page.goBack();
  await expect(page.getByRole("button", { name: "Add your note" })).toBeVisible();
  await expect(menu).toHaveCount(0);
});

test("Provider ABC launch uses the same clean menu lifecycle", async ({ page }) => {
  await page.goto("/dev/dashboard-continuity?role=provider");
  await page.getByRole("button", { name: "Add your note" }).click();
  await page.getByRole("button", { name: "A-B-C Data", exact: true }).click();

  const menu = page.locator('[role="menu"][aria-label="Documentation"]');
  await expect(menu).toHaveClass(/provider-action-menu--closing/);
  await expect(menu).toHaveAttribute("inert", "");
  await expect(page.getByRole("heading", { name: "A-B-C Data" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "A-B-C Data" })).toBeVisible();
  await expect(menu).toHaveCount(0);

  await page.goBack();
  await expect(page.getByRole("button", { name: "Add your note" })).toBeVisible();
  await expect(menu).toHaveCount(0);
});
