import { expect, test, type Page } from "@playwright/test";

const preview = "replayClientListEntrance=1";
const arrivalSelector = [
  ".dashboard-arrival-client-visual",
  ".dashboard-arrival-provider-visual",
  ".dashboard-arrival-provider-action",
  ".dashboard-arrival-utility",
].join(",");

async function activeArrivalAnimations(page: Page) {
  return page.evaluate((selector) =>
    document
      .getAnimations()
      .filter((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        const target = effect?.target;
        return (
          target instanceof Element &&
          target.matches(selector) &&
          Number(effect?.getTiming().duration) >= 500
        );
      })
      .map((animation) => {
        const effect = animation.effect as KeyframeEffect;
        const target = effect.target as HTMLElement;
        const timing = effect.getTiming();
        return {
          className: target.className,
          delay: timing.delay,
          duration: timing.duration,
          first: effect.getKeyframes()[0],
        };
      }),
    arrivalSelector
  );
}

test("provider arrival matches the approved spring and does not replay on carousel navigation", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(
    `/dev/dashboard-continuity?owners=1&role=provider&orbit=1&${preview}`,
    { waitUntil: "domcontentloaded" }
  );
  await expect(page.getByRole("button", { name: "Open Client Summary" })).toBeVisible();
  await page.waitForFunction(
    (selector) =>
      document.getAnimations().some((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        return (
          effect?.target instanceof Element &&
          effect.target.matches(selector) &&
          Number(effect.getTiming().duration) >= 500
        );
      }),
    arrivalSelector
  );

  const opening = await activeArrivalAnimations(page);
  expect(opening.some(({ className, duration, first }) =>
    String(className).includes("dashboard-arrival-client-visual") &&
    duration === 1000 && first.transform === "scale(0.72)"
  )).toBe(true);
  expect(opening.some(({ className, delay, duration, first }) =>
    String(className).includes("dashboard-arrival-provider-visual") &&
    delay === 0 && duration === 620 && first.transform === "scale(0.7)"
  )).toBe(true);
  expect(opening.some(({ className, delay, duration, first }) =>
    String(className).includes("dashboard-arrival-provider-action") &&
    delay === 28 && duration === 580 && first.transform === "scale(0.68)"
  )).toBe(true);
  expect(opening.some(({ className, delay, duration, first }) =>
    String(className).includes("dashboard-arrival-utility") &&
    delay === 0 && duration === 620 && first.transform === "scale(0.7)"
  )).toBe(true);

  await page.getByRole("button", { name: "Next client" }).click();
  await expect(page.getByText("2 of 2")).toBeVisible();
  await page.waitForTimeout(80);
  expect(await activeArrivalAnimations(page)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("grid arrival shares its allowance with the first selected supervisor orbit", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto(`/dev/dashboard-continuity?owners=1&${preview}`, {
    waitUntil: "domcontentloaded",
  });
  const firstClient = page.getByRole("button", { name: "Open Alpha Client" });
  await expect(firstClient).toBeVisible();
  await firstClient.click();
  await expect(page.getByRole("button", { name: "Open Client Summary" })).toBeVisible();

  const orbitOpening = await activeArrivalAnimations(page);
  expect(orbitOpening.some(({ className }) =>
    String(className).includes("dashboard-arrival-provider-visual")
  )).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Client List" }).click();
  await expect(page.getByRole("button", { name: "Open Alpha Client" })).toBeVisible();
  await page.getByRole("button", { name: "Open Alpha Client" }).click();
  await page.waitForTimeout(80);
  expect(await activeArrivalAnimations(page)).toEqual([]);
});

for (const owner of ["provider", "supervisor"] as const) {
  test(`${owner} reduced motion shows the dashboard at rest`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const role = owner === "provider" ? "&role=provider" : "";
    await page.goto(
      `/dev/dashboard-continuity?owners=1${role}&orbit=1&${preview}`,
      { waitUntil: "domcontentloaded" }
    );
    const center = page.getByRole("button", { name: "Open Client Summary" });
    await expect(center).toBeVisible();
    await page.waitForTimeout(100);
    expect(await activeArrivalAnimations(page)).toEqual([]);
    expect(
      await page.locator(".dashboard-arrival-client-visual").evaluate(
        (element) => getComputedStyle(element).transform
      )
    ).toBe("none");
    expect(
      await page.locator(".dashboard-utility-arrival-visual").first().evaluate(
        (element) => getComputedStyle(element).transform
      )
    ).toBe("none");
  });
}

for (const owner of ["provider", "supervisor"] as const) {
  test(`${owner} utility icons visibly reuse the provider spring without shrinking hit areas`, async ({ page }) => {
    const role = owner === "provider" ? "&role=provider" : "";
    await page.goto(
      `/dev/dashboard-continuity?owners=1${role}&orbit=1&${preview}`,
      { waitUntil: "domcontentloaded" }
    );
    await expect(page.getByRole("button", { name: "Open Client Summary" })).toBeVisible();
    await page.waitForFunction(() =>
      document.getAnimations().some((animation) => {
        const effect = animation.effect as KeyframeEffect | null;
        return (
          effect?.target instanceof Element &&
          effect.target.matches(".dashboard-utility-arrival-visual") &&
          effect.getTiming().duration === 620
        );
      })
    );

    const sample = await page.evaluate(() => {
      const visual = document.querySelector<HTMLElement>(
        ".dashboard-utility-arrival-visual.dashboard-arrival-utility"
      );
      if (!visual) throw new Error("utility visual not found");
      const animation = visual.getAnimations().find((candidate) => {
        const effect = candidate.effect as KeyframeEffect | null;
        return effect?.target === visual && effect.getTiming().duration === 620;
      });
      if (!animation) throw new Error("utility spring not found");
      animation.pause();
      animation.currentTime = 0;

      const control = visual.closest<HTMLElement>(
        ".dashboard-round-icon-control"
      );
      if (!control) throw new Error("utility control not found");
      const bounds = control.getBoundingClientRect();
      const result = {
        controlTransform: getComputedStyle(control).transform,
        visualScale: new DOMMatrix(getComputedStyle(visual).transform).a,
        opacity: getComputedStyle(visual).opacity,
        width: bounds.width,
        height: bounds.height,
      };
      animation.cancel();
      return result;
    });

    expect(sample.controlTransform).toBe("none");
    expect(sample.visualScale).toBeCloseTo(0.7, 2);
    expect(sample.opacity).toBe("1");
    expect(sample.width).toBeGreaterThanOrEqual(44);
    expect(sample.height).toBeGreaterThanOrEqual(44);
  });
}
