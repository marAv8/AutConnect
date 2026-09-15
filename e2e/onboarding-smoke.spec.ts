import { expect, test } from "@playwright/test";

test.describe("public onboarding", () => {
  test("login page exposes the expected account path", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("AutConnect", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create Account" })).toHaveAttribute(
      "href",
      "/create-account"
    );
  });

  test("public account creation cannot self-select Supervisor", async ({ page }) => {
    await page.goto("/create-account");

    const providerSelect = page.getByLabel("Provider");
    await expect(providerSelect).toBeVisible();
    await expect(providerSelect.locator('option[value="Supervisor"]')).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Register an agency or school" })
    ).toHaveAttribute("href", "/request-agency-access");
  });

  test("agency access request explains approval before account activation", async ({
    page,
  }) => {
    await page.goto("/request-agency-access");

    await expect(
      page.getByRole("heading", { name: "Request Agency Access" })
    ).toBeVisible();
    await expect(page.getByLabel("Agency or school name")).toBeVisible();
    await expect(page.getByLabel("Organization type")).toBeVisible();
    await expect(page.getByLabel("Administrator first name")).toBeVisible();
    await expect(page.getByLabel("Administrator last name")).toBeVisible();
    await expect(page.getByLabel("Company email")).toBeVisible();
    await expect(
      page.getByText("Submitting this form does not create an account.", {
        exact: false,
      })
    ).toBeVisible();
  });
});

test("platform agency approvals require an authorized session", async ({ page }) => {
  await page.goto("/platform/agency-requests");

  await expect(page).toHaveURL(/\/login(?:\?|$)/);
  await expect(page.getByRole("button", { name: "Login" })).toBeVisible();
});
