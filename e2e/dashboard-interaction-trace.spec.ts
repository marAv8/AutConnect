import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const panelSelector = "#autconnect-dashboard-trace-panel";
const outputName = "Interaction trace output";
async function openRecorder(page: Page) {
  await page.goto("/login?debugInteractions=1");
  const panel = page.locator(panelSelector);
  await expect(panel).not.toHaveAttribute("open", "");
  await panel.locator("summary").click();
  return panel;
}
async function productAttempt(page: Page) {
  await page.evaluate(() => {
    const probe = document.createElement("button");
    probe.dataset.dashboardTraceControl = "more";
    probe.id = "secret-client-id";
    probe.textContent = "Secret clinical content";
    document.body.append(probe);
    probe.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    window.__autConnectDashboardTrace?.record("handler", { target: "more" });
    window.__autConnectDashboardTrace?.record("state", { state: "menu-open" });
    probe.remove();
  });
}
async function liveEvents(page: Page) {
  return page.evaluate(() => window.__autConnectDashboardTrace?.read() ?? []);
}
async function show(page: Page) {
  await page.getByRole("button", { name: "Show", exact: true }).click();
  return page.getByRole("textbox", { name: outputName }).inputValue();
}

test("panel traffic cannot displace product evidence or change event propagation", async ({ page }) => {
  await openRecorder(page);
  await productAttempt(page);
  await show(page);
  const before = await liveEvents(page);
  const observed = await page.evaluate(() => {
    let bubbles = 0;
    const listener = () => bubbles++;
    document.addEventListener("pointerdown", listener);
    const panel = document.querySelector("#autconnect-dashboard-trace-panel")!;
    const targets = [panel, panel.querySelector("textarea")!, ...panel.querySelectorAll("button")];
    for (let i = 0; i < 1000; i++) {
      const target = targets[i % targets.length];
      target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      target.dispatchEvent(new TouchEvent("touchcancel", { bubbles: true }));
    }
    document.removeEventListener("pointerdown", listener);
    return bubbles;
  });
  expect(observed).toBe(1000);
  expect(await liveEvents(page)).toEqual(before);
});

test("bounded retention pins initialization and first utility handler/state despite heavy later traffic", async ({ page }) => {
  await openRecorder(page);
  await page.evaluate(() => {
    const probe = document.createElement("button");
    probe.dataset.dashboardTraceControl = "more";
    document.body.append(probe);
    probe.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    probe.remove();
    // Delayed handler/state must survive independently of the first context window.
    for (let i = 0; i < 500; i++) window.dispatchEvent(new PopStateEvent("popstate"));
    window.__autConnectDashboardTrace?.record("handler", { target: "more" });
    window.__autConnectDashboardTrace?.record("state", { state: "menu-open" });
    for (let i = 0; i < 500; i++) window.dispatchEvent(new PopStateEvent("popstate"));
  });
  const snapshot = JSON.parse(await show(page));
  expect(snapshot.events.length).toBeLessThanOrEqual(160);
  expect(snapshot.droppedEvents).toBe(snapshot.totalRecorded - snapshot.events.length);
  expect(snapshot.droppedEvents).toBeGreaterThan(800);
  expect(snapshot.events).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "bootstrap" }),
    expect.objectContaining({ kind: "pointerdown", target: "more" }),
    expect.objectContaining({ kind: "handler", target: "more" }),
    expect.objectContaining({ kind: "state", state: "menu-open" }),
  ]));
});

test("capture continues from login document to the actual synthetic Dashboard owner", async ({ page }) => {
  await openRecorder(page);
  // No login submission: document navigation exercises session-local recorder continuity.
  await page.goto("/dev/dashboard-continuity?owners=1&role=supervisor");
  await page.getByRole("button", { name: "More", exact: true }).click();
  await expect(page.getByRole("button", { name: "More", exact: true })).toHaveAttribute("aria-expanded", "true");
  await page.locator(`${panelSelector} summary`).click();
  const snapshot = JSON.parse(await show(page));
  expect(snapshot.events).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "bootstrap", route: "auth", document: 1 }),
    expect.objectContaining({ kind: "handler", target: "more", route: "dashboard", document: 2 }),
    expect.objectContaining({ kind: "state", state: "menu-open", route: "dashboard" }),
  ]));
});

test("Show freezes output; Copy and Download export that exact snapshot; refresh is explicit", async ({ page }) => {
  await openRecorder(page);
  await productAttempt(page);
  const frozen = await show(page);
  expect(frozen).not.toContain("Secret clinical content");
  expect(frozen).not.toContain("secret-client-id");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text: string) => { Object.assign(window, { __copiedTrace: text }); },
    } });
    window.__autConnectDashboardTrace?.record("state", { state: "grid" });
  });
  expect(await show(page)).toBe(frozen);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Copied");
  expect(await page.evaluate(() => (window as typeof window & { __copiedTrace: string }).__copiedTrace)).toBe(frozen);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download JSON", exact: true }).click();
  const download = await downloadPromise;
  expect(await readFile((await download.path())!, "utf8")).toBe(frozen);
  await page.getByRole("button", { name: "Refresh snapshot", exact: true }).click();
  expect(await page.getByRole("textbox", { name: outputName }).inputValue()).not.toBe(frozen);
});

for (const failure of ["absent", "rejected"]) {
  test(`clipboard ${failure} gives feedback and manual fallback`, async ({ page }) => {
    await openRecorder(page);
    await productAttempt(page);
    const frozen = await show(page);
    await page.evaluate((mode) => {
      Object.defineProperty(navigator, "clipboard", { configurable: true, value: mode === "absent" ? undefined : {
        writeText: async () => { throw new Error("Denied"); },
      } });
    }, failure);
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("copy");
    await expect(page.getByRole("status")).toContainText("Select text");
    await expect(page.getByRole("status")).not.toContainText("Copied");
    await page.getByRole("button", { name: "Select text", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("not copied");
    const output = page.getByRole("textbox", { name: outputName });
    await expect(output).toHaveAttribute("readonly", "");
    expect(await output.inputValue()).toBe(frozen);
  });
}

test("Clear, fresh capture and disable/delete have distinct effects", async ({ page }) => {
  await openRecorder(page);
  await productAttempt(page);
  await show(page);
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  expect(await liveEvents(page)).toEqual([]);
  await expect(page.getByRole("textbox", { name: outputName })).toBeHidden();
  await productAttempt(page);
  expect((await liveEvents(page)).length).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Fresh capture", exact: true }).click();
  expect(await liveEvents(page)).toEqual([expect.objectContaining({ sequence: 1, kind: "capture-start" })]);
  await page.getByRole("button", { name: "Disable & delete", exact: true }).click();
  await expect(page.locator(panelSelector)).toHaveCount(0);
  expect(await page.evaluate(() => ({
    api: Boolean(window.__autConnectDashboardTrace),
    keys: Object.keys(sessionStorage).filter(key => key.startsWith("autconnect-dashboard-interaction-trace")),
  }))).toEqual({ api: false, keys: [] });
  await page.goto("/login");
  await expect(page.locator(panelSelector)).toHaveCount(0);
});

test("collapsed recorder has no hit surface outside visible bounds on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/dev/dashboard-continuity?owners=1&role=provider&debugInteractions=1");
  await page.getByRole("button", { name: "Open Alpha Client", exact: true }).click();
  await page.getByRole("button", { name: "Published — view or update today's note", exact: true }).click();
  await page.getByRole("button", { name: "Update Note", exact: true }).click();
  await page.getByRole("button", { name: "A-B-C Data", exact: true }).click();
  await page.getByRole("button", { name: "Client", exact: true }).click();
  await expect(page.getByRole("heading", { name: "A-B-C Data" })).toHaveCount(0);
  const outsideHits = await page.evaluate(() => {
    const panel = document.querySelector("#autconnect-dashboard-trace-panel")!;
    const rect = panel.getBoundingClientRect();
    const hits = [];
    for (let y = 5; y < innerHeight; y += 20) for (let x = 5; x < innerWidth; x += 20) {
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) continue;
      if (panel.contains(document.elementFromPoint(x, y))) hits.push([x,y]);
    }
    return hits;
  });
  expect(outsideHits).toEqual([]);
});

test("Copy reports success only after the clipboard promise resolves", async ({ page }) => {
  await openRecorder(page);
  await show(page);
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: () => new Promise<void>(resolve => { Object.assign(window, { __finishCopy: resolve }); }),
    } });
  });
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Copying");
  await expect(page.getByRole("status")).not.toContainText("Copied");
  await page.evaluate(() => (window as typeof window & { __finishCopy: () => void }).__finishCopy());
  await expect(page.getByRole("status")).toContainText("Copied");
});

test("restored documents reconcile newer local evidence and honor disable", async ({ page }) => {
  await openRecorder(page);
  await productAttempt(page);
  await page.evaluate(() => {
    // Model a newer document having appended a record to this tab's session store.
    const key = "autconnect-dashboard-interaction-trace-events";
    const stored = JSON.parse(sessionStorage.getItem(key)!);
    const newer = { ...stored.recent.at(-1), sequence: stored.sequence + 1, kind: "state", state: "orbit", route: "dashboard", document: 2 };
    stored.recent.push(newer);
    stored.sequence++;
    stored.totalRecorded++;
    stored.document = 2;
    sessionStorage.setItem(key, JSON.stringify(stored));
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  expect(await liveEvents(page)).toEqual(expect.arrayContaining([
    expect.objectContaining({ route: "dashboard", state: "orbit", document: 2 }),
    expect.objectContaining({ kind: "pageshow", persisted: true, document: 3 }),
  ]));
  await page.evaluate(() => {
    sessionStorage.removeItem("autconnect-dashboard-interaction-trace-enabled");
    sessionStorage.removeItem("autconnect-dashboard-interaction-trace-events");
    window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await expect(page.locator(panelSelector)).toHaveCount(0);
  expect(await page.evaluate(() => Boolean(window.__autConnectDashboardTrace))).toBe(false);
});

test("legacy panel-heavy traces are sanitized and earlier unknown loss is explicit", async ({ page }) => {
  await page.goto("/login");
  await page.evaluate(() => {
    const events = Array.from({ length: 160 }, (_, index) => ({
      sequence: 679 + index, elapsedMs: index, kind: "pointerdown", route: "auth",
      target: index < 111 ? "diagnostic-panel" : "more", value: "must-not-export",
    }));
    sessionStorage.setItem("autconnect-dashboard-interaction-trace-enabled", "1");
    sessionStorage.setItem("autconnect-dashboard-interaction-trace-events", JSON.stringify(events));
  });
  await page.reload();
  await page.locator(`${panelSelector} summary`).click();
  const text = await show(page);
  const snapshot = JSON.parse(text);
  expect(snapshot.legacyHistoryUnavailable).toBe(true);
  expect(snapshot.totalRecorded).toBeLessThan(100);
  expect(snapshot.events.filter((event: { sequence: number }) => event.sequence <= 838)).toHaveLength(49);
  expect(text).not.toContain("must-not-export");
  expect(text).not.toContain('"target": "diagnostic-panel"');
});
