import { expect, test } from "@playwright/test";

for (const width of [375, 1280]) {
  for (const theme of ["light", "dark"]) {
    test(`Inbox separate attention rows at ${width}px in ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.addInitScript(theme => localStorage.setItem("autconnect-theme", theme), theme);
      await page.goto("/dev/inbox-attention");
      await expect(page.locator("html")).toHaveClass(theme === "dark" ? /dark/ : /^(?!.*dark)/);
      const trigger = page.getByRole("button", { name: "Inbox, 20 pending actions", exact: true });
      await trigger.click();
      const menu = page.getByRole("navigation", { name: "Inbox destinations" });
      await expect(menu).toBeVisible();
      for (const [name, href] of [
        ["Case Support Requests 2", "/portal/case-support/requests"],
        ["My Organization Invitations 5", "/portal/organization/invitations"],
        ["Organization Access Requests 4", "/platform/agency-requests"],
        ["Client Participation Requests 6", "/portal/supervisor/edit-providers"],
        ["Client Organization Invitations 3", "/portal/organization/client-invitations"],
      ]) await expect(menu.getByRole("link", { name, exact: true })).toHaveAttribute("href", href);
      const geometry = await menu.evaluate(node => {
        const box = node.getBoundingClientRect();
        return { left: box.left, right: box.right, top: box.top, bottom: box.bottom,
          width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth,
          links: [...node.querySelectorAll("a")].map(link => link.getBoundingClientRect().height) };
      });
      expect(geometry.left).toBeGreaterThanOrEqual(0);
      expect(geometry.right).toBeLessThanOrEqual(width);
      expect(geometry.top).toBeGreaterThanOrEqual(0);
      expect(geometry.bottom).toBeLessThan(844);
      expect(geometry.scroll).toBe(geometry.width);
      expect(geometry.links.every(height => height >= 44)).toBe(true);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
      await trigger.click();
      await expect(menu).toBeVisible();
    });
  }
}

test("each category alone activates Inbox; zero stays quiet", async ({ page }) => {
  for (const [category, count] of [["case", 2], ["client-organization", 3], ["platform", 4], ["recipient", 5], ["manager", 6], ["zero", 0]] as const) {
    await page.goto(`/dev/inbox-attention?category=${category}`);
    const trigger = page.getByRole("button", { name: `Inbox, ${count} pending actions`, exact: true });
    await expect(trigger).toBeVisible();
    await expect(trigger.locator(".dashboard-case-support-badge")).toHaveCount(count ? 1 : 0);
    await expect(trigger.locator(".dashboard-case-support-icon--quiet")).toHaveCount(count ? 0 : 1);
  }
});
